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
  // srv-social (0013): чат/переезды/отпуск/присмотр/менторство/косметика/онбординг.
  chat_post: ["chat_post", (b) => ({ p_channel_kind: b.channel_kind ?? b.channel, p_body: b.body ?? null, p_sticker_key: b.sticker_key ?? null })],
  migration_propose: ["migration_propose", (b) => ({ p_kind: b.kind ?? "street_caravan", p_target_town: b.target_town })],
  migration_vote: ["migration_vote", (b) => ({ p_proposal: b.proposal_id, p_vote: b.vote })],
  migration_move: ["migration_move", (b) => ({ p_target_town: b.target_town })],
  vacation_start: ["vacation_start", (b) => ({ p_days: b.days ?? 14 })],
  vacation_end: ["vacation_end", () => ({})],
  neighbor_sit: ["neighbor_sit", (b) => ({ p_host: b.host_id })],
  mentor_invite: ["mentor_invite", (b) => ({ p_mentee: b.mentee_id })],
  mentor_complete: ["mentor_complete", (b) => ({ p_mentee: b.mentee_id, p_milestone: b.milestone })],
  decor_set: ["decor_set", (b) => ({ p_decor_key: b.decor_key, p_slot: b.slot ?? null, p_placed: b.placed ?? true, p_layout: b.layout ?? null })],
  neon_save: ["neon_save", (b) => ({ p_config: b.config })],
  onboarding_step: ["onboarding_step", (b) => ({ p_step: b.step ?? null, p_flag: b.flag ?? null })],
  // srv-gameplay (0012): прогрессия/ярмарка/смена/конкурсы/экспедиции/почта/фуражинг/секретки/питомцы.
  building_upgrade: ["building_upgrade", (b) => ({ p_building_key: b.building_key })],
  research_start: ["research_start", (b) => ({ p_node_key: b.node_key })],
  staff_assign: ["staff_assign", (b) => ({ p_staff_key: b.staff_key, p_post: b.post })],
  staff_upgrade: ["staff_upgrade", (b) => ({ p_staff_key: b.staff_key })],
  fair_stall_set: ["fair_stall_set", (b) => ({ p_lots: b.lots ?? [] })],
  fair_collect: ["fair_collect", () => ({})],
  shift_submit: ["shift_submit", () => ({})],
  contest_enter: ["contest_enter", (b) => ({ p_contest_key: b.contest_key, p_payload: b.payload ?? {} })],
  contest_vote: ["contest_vote", (b) => ({ p_contest_id: b.contest_id, p_entry_id: b.entry_id })],
  expedition_start: ["expedition_start", (b) => ({ p_state_key: b.state_key, p_route_slot: b.route_slot ?? 1 })],
  expedition_collect: ["expedition_collect", (b) => ({ p_exp_ids: b.exp_ids })],
  mail_order: ["mail_order", (b) => ({ p_item_key: b.item_key })],
  mail_collect: ["mail_collect", (b) => ({ p_order_ids: b.order_ids })],
  mail_claim: ["mail_collect", (b) => ({ p_order_ids: b.order_ids })], // алиас спеки → mail_collect
  mail_speedup: ["mail_speedup", (b) => ({ p_order_id: b.order_id })],
  forage_collect: ["forage_collect", (b) => ({ p_point_id: b.point_id })],
  fish_cast: ["fish_cast", () => ({})],
  recipe_experiment: ["recipe_experiment", (b) => ({ p_inputs: b.inputs ?? [] })],
  rename_pet: ["rename_pet", (b) => ({ p_animal_id: b.animal_id, p_name: b.name })],
  affection_gift: ["affection_gift", (b) => ({ p_animal_id: b.animal_id, p_gift_key: b.gift_key })],
};

// Действия, реализованные в Edge (service_role). Открытие прилавка и выкладка
// лотов остаются в Edge; остальной геймплей-домен перенесён в Postgres-RPC
// (0012_server_gameplay.sql): shift_submit/expedition_*/mail_*/forage_collect/
// fish_cast теперь — SECURITY DEFINER RPC (см. RPC_ACTIONS выше).
type EdgeHandler = (admin: ReturnType<typeof adminClient>, uid: string, body: Record<string, unknown>) => Promise<unknown>;
const EDGE_ACTIONS: Record<string, EdgeHandler> = {
  fair_open: (a, u, b) => H.fairOpen(a, u, b as { stall_id: string }),
  fair_list: (a, u, b) => H.fairList(a, u, b as { lots: [] }),
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
