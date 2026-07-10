// game — единый шлюз игровых действий (20-backend.md §3.4 «одна истина, один шлюз»).
// Быстрый путь: форвардит в Postgres SECURITY DEFINER RPC под JWT игрока
// (auth.uid() резолвится). Действия без RPC (ярмарка/смена/экспедиции/почта/
// фуражинг) реализованы в handlers.ts под service_role с серверной валидацией.
// Идемпотентность мутаций — по request_id (заголовок x-request-id или поле body).
import { preflight } from "../_shared/cors.ts";
import { ok, fail, failFromError } from "../_shared/response.ts";
import { adminClient, userClient } from "../_shared/supabase.ts";
import { requireUser } from "../_shared/auth.ts";
import { withIdem } from "../_shared/idem.ts";
import * as H from "./handlers.ts";

// Действия-обёртки над Postgres RPC: action → [rpc_name, (body)=>params].
const RPC_ACTIONS: Record<string, [string, (b: Record<string, unknown>) => Record<string, unknown>]> = {
  harvest: ["harvest", (b) => ({ plot_ids: b.plot_ids })],
  plant: ["sow", (b) => ({ p_slot: b.slot, p_seed_key: b.seed_key })],
  sow: ["sow", (b) => ({ p_slot: b.slot, p_seed_key: b.seed_key })],
  water: ["water", (b) => ({ plot_ids: b.plot_ids })],
  craft_start: ["craft_start", (b) => ({ p_machine: b.machine_id, p_recipe_key: b.recipe_key, p_batch: b.batch ?? 1 })],
  craft_collect: ["craft_collect", (b) => ({ job_ids: b.job_ids })],
  sell_to_market: ["sell_to_market", (b) => ({ p_item_key: b.item_key, p_qty: b.qty })],
  coop_contribute: ["coop_contribute", (b) => ({ p_order: b.order_id, p_item_key: b.item_key, p_qty: b.qty })],
  potluck_contribute: ["potluck_contribute", (b) => ({ p_week: b.week, p_item_key: b.item_key, p_qty: b.qty })],
  event_contribute: ["event_contribute", (b) => ({ p_item_key: b.item_key, p_qty: b.qty, p_channel: b.channel })],
  help_neighbor: ["help_neighbor", (b) => ({ p_target: b.target_id, p_action: b.action_type })],
  gift_send: ["gift_send", (b) => ({ p_to: b.to_id, p_item_key: b.item_key, p_qty: b.qty })],
  feed_animal: ["feed_animal", (b) => ({ animal_ids: b.animal_ids })],
  collect_animal_product: ["collect_animal_product", (b) => ({ animal_ids: b.animal_ids })],
  prize_pull: ["prize_pull", (b) => ({ p_series: b.series_key, p_count: b.count ?? 1 })],
  streak_check: ["streak_check", () => ({})],
  streak_insure: ["streak_insure", () => ({})],
  wallet_get: ["wallet_get", () => ({})],
};

// Действия, реализованные в Edge (service_role) — нет готового RPC.
type EdgeHandler = (admin: ReturnType<typeof adminClient>, uid: string, body: Record<string, unknown>) => Promise<unknown>;
const EDGE_ACTIONS: Record<string, EdgeHandler> = {
  fair_open: (a, u, b) => H.fairOpen(a, u, b as { stall_id: string }),
  fair_list: (a, u, b) => H.fairList(a, u, b as { lots: [] }),
  shift_submit: (a, u, b) => H.shiftSubmit(a, u, b),
  expedition_start: (a, u, b) => H.expeditionStart(a, u, b as { state_key: string; route_slot?: number }),
  expedition_collect: (a, u, b) => H.expeditionCollect(a, u, b as { exp_ids: string[] }),
  mail_order: (a, u, b) => H.mailOrder(a, u, b as { item_key: string }),
  mail_claim: (a, u, b) => H.mailClaim(a, u, b as { order_ids: string[] }),
  forage_collect: (a, u, b) => H.forageCollect(a, u, b as { point_id: string }),
  fish_cast: (a, u) => H.fishCast(a, u),
};

// Только-чтение (без идемпотентности).
const READONLY = new Set(["wallet_get"]);

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return fail("method_not_allowed", "POST only", 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("bad_json", "invalid JSON body", 400);
  }
  const action = String(body.action ?? "");
  if (!action) return fail("no_action", "field 'action' required", 400);

  const admin = adminClient();
  let uid: string, jwt: string;
  try {
    ({ uid, jwt } = await requireUser(admin, req));
  } catch (e) {
    return fail("unauthorized", (e as Error).message, 401);
  }

  const requestId = req.headers.get("x-request-id") ?? (body.request_id as string | undefined);

  const run = async (): Promise<unknown> => {
    if (action in RPC_ACTIONS) {
      const [rpc, mk] = RPC_ACTIONS[action];
      const uc = userClient(jwt);
      const { data, error } = await uc.rpc(rpc, mk(body));
      if (error) throw new Error(error.message);
      return data;
    }
    if (action in EDGE_ACTIONS) {
      return await EDGE_ACTIONS[action](admin, uid, body);
    }
    throw new Error(`unknown_action:${action}`);
  };

  try {
    if (!(action in RPC_ACTIONS) && !(action in EDGE_ACTIONS)) {
      return fail("unknown_action", `no such action: ${action}`, 404);
    }
    // Идемпотентность: мутации с request_id выполняются ровно один раз.
    if (requestId && !READONLY.has(action)) {
      const scope = `rpc:${action}`;
      const key = `${uid}:${requestId}`;
      const { data, replayed } = await withIdem(admin, scope, key, run);
      return ok({ ...(data as Record<string, unknown>), replayed });
    }
    const data = await run();
    return ok(data);
  } catch (e) {
    return failFromError(e);
  }
});
