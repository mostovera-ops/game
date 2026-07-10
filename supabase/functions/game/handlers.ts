// Edge-реализация действий, у которых нет готового Postgres-RPC
// (ярмарка, смена, экспедиции, почта, фуражинг). Вся валидация — серверная:
// таймеры от now(), сток списывается атомарно через internal-хелперы
// (inv_remove/inv_add/ledger_write вызываются под service_role — клиент к ним
// доступа не имеет, 0006 REVOKE). Клиентские числа игнорируются.
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

interface FarmCtx {
  farm_id: string;
  town_id: string | null;
  week: number;
}

export async function farmCtx(
  admin: SupabaseClient,
  uid: string,
): Promise<FarmCtx> {
  const { data: farm } = await admin
    .from("farms")
    .select("id, town_id")
    .eq("player_id", uid)
    .maybeSingle();
  if (!farm) throw new Error("no_farm");
  let week = 0;
  if (farm.town_id) {
    const { data: town } = await admin
      .from("towns")
      .select("current_week_index")
      .eq("id", farm.town_id)
      .maybeSingle();
    week = town?.current_week_index ?? 0;
  }
  return { farm_id: farm.id, town_id: farm.town_id, week };
}

async function cfg(
  admin: SupabaseClient,
  farm_id: string,
  ns: string,
): Promise<Record<string, unknown>> {
  const { data } = await admin.rpc("config_doc", { p_farm: farm_id, p_ns: ns });
  return (data as Record<string, unknown>) ?? {};
}

async function invRemove(
  admin: SupabaseClient,
  farm: string,
  key: string,
  qty: number,
  quality = 0,
): Promise<boolean> {
  const { data, error } = await admin.rpc("inv_remove", {
    p_farm: farm,
    p_key: key,
    p_qty: qty,
    p_quality: quality,
  });
  if (error) throw new Error(`inv_remove:${error.message}`);
  return data === true;
}

async function invAdd(
  admin: SupabaseClient,
  farm: string,
  key: string,
  klass: string,
  qty: number,
  quality = 0,
): Promise<void> {
  const { error } = await admin.rpc("inv_add", {
    p_farm: farm,
    p_key: key,
    p_class: klass,
    p_qty: qty,
    p_quality: quality,
  });
  if (error) throw new Error(`inv_add:${error.message}`);
}

async function logAudit(
  admin: SupabaseClient,
  uid: string,
  action: string,
  result: string,
  reason?: string,
): Promise<void> {
  await admin.from("audit_logs").insert({
    actor_id: uid,
    action,
    result,
    reject_reason: reason ?? null,
  });
}

// --- Ярмарка: открыть прилавок (старт пассива) -----------------------------
export async function fairOpen(
  admin: SupabaseClient,
  uid: string,
  p: { stall_id: string },
) {
  const { data, error } = await admin
    .from("fair_stalls")
    .update({ opened_at: new Date().toISOString() })
    .eq("id", p.stall_id)
    .eq("player_id", uid)
    .select("id, opened_at")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("no_stall");
  return { stall_id: data.id, opened_at: data.opened_at };
}

// --- Ярмарка: выложить лоты (резерв стока из склада) -----------------------
export async function fairList(
  admin: SupabaseClient,
  uid: string,
  p: { lots: Array<{ slot_index: number; item_key: string; quality?: number; qty: number; price: number }> },
) {
  const ctx = await farmCtx(admin, uid);
  // Окно ярмарки открыто? (server_calendars текущей недели города)
  const { data: cal } = await admin
    .from("server_calendars")
    .select("fair_open, fair_close")
    .eq("town_id", ctx.town_id)
    .eq("week_index", ctx.week)
    .maybeSingle();
  const now = Date.now();
  if (
    cal && (now < Date.parse(cal.fair_open) || now >= Date.parse(cal.fair_close))
  ) {
    await logAudit(admin, uid, "fair_list", "rejected", "window_closed");
    throw new Error("fair_window_closed");
  }
  // Upsert прилавка на эту неделю.
  const { data: stall, error: se } = await admin
    .from("fair_stalls")
    .upsert(
      { player_id: uid, town_id: ctx.town_id, week_index: ctx.week },
      { onConflict: "player_id,week_index" },
    )
    .select("id, display_slots")
    .maybeSingle();
  if (se || !stall) throw new Error(se?.message ?? "no_stall");

  const listed: Array<{ slot: number; item_key: string; qty: number }> = [];
  for (const lot of p.lots) {
    if (lot.qty <= 0) continue;
    if (lot.slot_index < 0 || lot.slot_index >= stall.display_slots) continue;
    // Резервируем сток: списываем из inventory (античит — «продажа несуществующего»).
    const okStock = await invRemove(
      admin, ctx.farm_id, lot.item_key, lot.qty, lot.quality ?? 0,
    );
    if (!okStock) continue; // тихо пропускаем нехватку — как harvest B4
    await admin.from("fair_lots").upsert(
      {
        stall_id: stall.id,
        slot_index: lot.slot_index,
        item_key: lot.item_key,
        quality: lot.quality ?? 0,
        qty_listed: lot.qty,
        qty_sold: 0,
        price: lot.price,
      },
      { onConflict: "stall_id,slot_index" },
    );
    listed.push({ slot: lot.slot_index, item_key: lot.item_key, qty: lot.qty });
  }
  await logAudit(admin, uid, "fair_list", "ok");
  return { stall_id: stall.id, listed };
}

// --- Смена у прилавка: сервер реконструирует итог из фактических продаж ------
export async function shiftSubmit(
  admin: SupabaseClient,
  uid: string,
  _p: { shift_log?: unknown },
) {
  const ctx = await farmCtx(admin, uid);
  const caps = await cfg(admin, ctx.farm_id, "caps");
  const shiftsPerWindow = Number(caps["shift_per_fair_window"] ?? 3);
  const cooldownH = Number(caps["shift_cooldown_hours"] ?? 2);
  const ticketCap = Number(caps["ticket_cap_per_week"] ?? 5);

  // Окно ярмарки текущей недели.
  const { data: cal } = await admin
    .from("server_calendars")
    .select("fair_open, fair_close")
    .eq("town_id", ctx.town_id)
    .eq("week_index", ctx.week)
    .maybeSingle();
  const windowStart = cal ? cal.fair_open : new Date(0).toISOString();

  // Лимит ≤N смен/окно + кулдаун между сменами (по audit_logs).
  const { data: past } = await admin
    .from("audit_logs")
    .select("at")
    .eq("actor_id", uid)
    .eq("action", "shift_submit")
    .eq("result", "ok")
    .gte("at", windowStart)
    .order("at", { ascending: false });
  const done = past?.length ?? 0;
  if (done >= shiftsPerWindow) {
    await logAudit(admin, uid, "shift_submit", "rejected", "shift_cap");
    throw new Error("shift_cap");
  }
  if (past && past.length > 0) {
    const last = Date.parse(past[0].at);
    if (Date.now() - last < cooldownH * 3600_000) {
      await logAudit(admin, uid, "shift_submit", "rejected", "cooldown");
      throw new Error("shift_cooldown");
    }
  }

  // Реконструкция итога: суммируем фактические пассивные продажи с прошлой смены.
  const sinceIso = past && past.length > 0 ? past[0].at : windowStart;
  const { data: sales } = await admin
    .from("fair_sales")
    .select("revenue, fp")
    .eq("player_id", uid)
    .gt("tick_at", sinceIso);
  let revenue = 0, fp = 0;
  for (const s of sales ?? []) {
    revenue += Number(s.revenue ?? 0);
    fp += Number(s.fp ?? 0);
  }
  const tips = Math.floor(revenue * 0.1); // гипотеза баланса (14-economy.md)
  const fairScore = revenue + fp;

  // Тикеты из смены с недельным кэпом (R10).
  const { data: weekTickets } = await admin
    .from("currency_ledgers")
    .select("delta")
    .eq("player_id", uid)
    .eq("currency", "tickets")
    .eq("reason", "shift_reward")
    .gte("at", new Date(Date.now() - 7 * 86400_000).toISOString());
  const earnedThisWeek = (weekTickets ?? []).reduce(
    (a, r) => a + Math.max(0, Number(r.delta)), 0,
  );
  let tickets = Math.min(1 + Math.floor(fp / 50), ticketCap - earnedThisWeek);
  if (tickets < 0) tickets = 0;

  if (tips > 0) {
    await admin.from("currency_ledgers").insert({
      player_id: uid, currency: "bucks", delta: tips,
      reason: "shift_tips", ref_type: "fair", ref_id: ctx.farm_id,
    });
  }
  if (tickets > 0) {
    await admin.from("currency_ledgers").insert({
      player_id: uid, currency: "tickets", delta: tickets,
      reason: "shift_reward", ref_type: "fair", ref_id: ctx.farm_id,
    });
  }
  await logAudit(admin, uid, "shift_submit", "ok");
  return { tips, fair_score: fairScore, tickets, fp };
}

// --- Экспедиции ------------------------------------------------------------
export async function expeditionStart(
  admin: SupabaseClient,
  uid: string,
  p: { state_key: string; route_slot?: number },
) {
  const ctx = await farmCtx(admin, uid);
  const timers = await cfg(admin, ctx.farm_id, "timers");
  const hoursMap = (timers["expedition_hours"] as Record<string, number>) ?? {};
  const hours = hoursMap[p.state_key];
  if (!hours) throw new Error("state_locked");

  // Слот занят? (незабранная экспедиция в том же route_slot)
  const slot = p.route_slot ?? 1;
  const { data: busy } = await admin
    .from("expeditions")
    .select("id")
    .eq("farm_id", ctx.farm_id)
    .eq("route_slot", slot)
    .eq("collected", false)
    .maybeSingle();
  if (busy) throw new Error("slot_busy");

  // Детерминированный payload (seed = farm:state:week) — гарантированный ≥1 ряд (P3).
  const drops = await cfg(admin, ctx.farm_id, "drops");
  const rows = Number(drops["expedition_guaranteed_rows"] ?? 1);
  const payload = Array.from({ length: rows }, (_, i) => ({
    item_key: `${p.state_key}_crate`,
    item_class: "crop",
    qty: 1 + i,
    quality: 1,
  }));
  const now = new Date();
  const returnAt = new Date(now.getTime() + hours * 3600_000);
  const { data: exp, error } = await admin
    .from("expeditions")
    .insert({
      farm_id: ctx.farm_id,
      state_key: p.state_key,
      route_slot: slot,
      departed_at: now.toISOString(),
      return_at: returnAt.toISOString(),
      payload,
      collected: false,
    })
    .select("id, return_at")
    .maybeSingle();
  if (error) throw new Error(error.message);
  await logAudit(admin, uid, "expedition_start", "ok");
  return { expedition: exp!.id, return_at: exp!.return_at };
}

export async function expeditionCollect(
  admin: SupabaseClient,
  uid: string,
  p: { exp_ids: string[] },
) {
  const ctx = await farmCtx(admin, uid);
  const { data: exps } = await admin
    .from("expeditions")
    .select("id, payload")
    .in("id", p.exp_ids)
    .eq("farm_id", ctx.farm_id)
    .eq("collected", false)
    .lte("return_at", new Date().toISOString());
  const items: unknown[] = [];
  for (const e of exps ?? []) {
    for (const row of (e.payload as Array<Record<string, unknown>>) ?? []) {
      await invAdd(
        admin, ctx.farm_id,
        String(row.item_key), String(row.item_class ?? "crop"),
        Number(row.qty ?? 1), Number(row.quality ?? 1),
      );
      items.push(row);
    }
    await admin.from("expeditions").update({ collected: true }).eq("id", e.id);
  }
  await logAudit(admin, uid, "expedition_collect", "ok");
  return { items };
}

// --- Почта (Postman Pete) --------------------------------------------------
export async function mailOrder(
  admin: SupabaseClient,
  uid: string,
  p: { item_key: string },
) {
  const ctx = await farmCtx(admin, uid);
  const caps = await cfg(admin, ctx.farm_id, "caps");
  const inTransitMax = Number(caps["mail_in_transit_max"] ?? 5);
  const timers = await cfg(admin, ctx.farm_id, "timers");
  const dh = (timers["mail_deliver_hours"] as number[]) ?? [8, 20];

  const { count } = await admin
    .from("mail_orders")
    .select("id", { count: "exact", head: true })
    .eq("player_id", uid)
    .eq("collected", false);
  if ((count ?? 0) >= inTransitMax) throw new Error("mail_transit_cap");

  const hours = dh[0] + Math.random() * (dh[1] - dh[0]);
  const deliverAt = new Date(Date.now() + hours * 3600_000);
  const { data: order, error } = await admin
    .from("mail_orders")
    .insert({
      player_id: uid,
      item_key: p.item_key,
      ordered_at: new Date().toISOString(),
      deliver_at: deliverAt.toISOString(),
      delivered: false,
      collected: false,
    })
    .select("id, deliver_at")
    .maybeSingle();
  if (error) throw new Error(error.message);
  await logAudit(admin, uid, "mail_order", "ok");
  return { order: order!.id, deliver_at: order!.deliver_at };
}

export async function mailClaim(
  admin: SupabaseClient,
  uid: string,
  p: { order_ids: string[] },
) {
  const ctx = await farmCtx(admin, uid);
  const { data: orders } = await admin
    .from("mail_orders")
    .select("id, item_key")
    .in("id", p.order_ids)
    .eq("player_id", uid)
    .eq("collected", false)
    .lte("deliver_at", new Date().toISOString());
  const items: string[] = [];
  for (const o of orders ?? []) {
    await invAdd(admin, ctx.farm_id, o.item_key, "consumable", 1, 0);
    await admin.from("mail_orders")
      .update({ delivered: true, collected: true }).eq("id", o.id);
    items.push(o.item_key);
  }
  await logAudit(admin, uid, "mail_claim", "ok");
  return { items };
}

// --- Фуражинг (атомарный декремент пула, мягкая гонка F6) -------------------
export async function forageCollect(
  admin: SupabaseClient,
  uid: string,
  p: { point_id: string },
) {
  const ctx = await farmCtx(admin, uid);
  // Тип точки и дневной кэп по типу (анти-обход через инстансы, 08 §3.2.3).
  const { data: pt } = await admin
    .from("foraging_points")
    .select("id, point_type, pool_remaining")
    .eq("id", p.point_id)
    .maybeSingle();
  if (!pt) throw new Error("no_point");

  const dailyCap = 8; // гипотеза; финализируется 08-mail-foraging.md
  const gd = new Date().toISOString().slice(0, 10);
  const { data: fd } = await admin
    .from("forage_daily")
    .select("count")
    .eq("player_id", uid)
    .eq("point_type", pt.point_type)
    .eq("game_day", gd)
    .maybeSingle();
  if ((fd?.count ?? 0) >= dailyCap) throw new Error("daily_cap");

  // Атомарный декремент: WHERE pool_remaining>0 (гонка → 0 строк = мягко «уже собрали»).
  const { data: dec } = await admin
    .from("foraging_points")
    .update({ pool_remaining: (pt.pool_remaining as number) - 1 })
    .eq("id", p.point_id)
    .gt("pool_remaining", 0)
    .select("id")
    .maybeSingle();
  if (!dec) return { collected: false, reason: "already_depleted" };

  await admin.from("forage_daily").upsert(
    { player_id: uid, point_type: pt.point_type, game_day: gd, count: (fd?.count ?? 0) + 1 },
    { onConflict: "player_id,point_type,game_day" },
  );
  await invAdd(admin, ctx.farm_id, `forage_${pt.point_type}`, "crop", 1, 1);
  await logAudit(admin, uid, "forage_collect", "ok");
  return { collected: true, item: `forage_${pt.point_type}` };
}

// --- Рыбалка (серверный RNG, гарантированный Common — P3) -------------------
export async function fishCast(admin: SupabaseClient, uid: string) {
  const ctx = await farmCtx(admin, uid);
  const roll = Math.random();
  const rarity = roll < 0.02 ? "legendary" : roll < 0.15 ? "rare" : "common";
  const item = `fish_${rarity}`;
  await invAdd(admin, ctx.farm_id, item, "crop", 1, rarity === "common" ? 1 : 3);
  await logAudit(admin, uid, "fish_cast", "ok");
  return { catch: { item_key: item, rarity } };
}
