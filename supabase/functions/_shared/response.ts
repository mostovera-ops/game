// Единый конверт ответа всех функций (20-backend.md §3.4): { ok, data?, error? }.
import { corsHeaders } from "./cors.ts";

export interface Envelope<T = unknown> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

const JSON_HEADERS = { ...corsHeaders, "Content-Type": "application/json" };

export function ok<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify({ ok: true, data } satisfies Envelope<T>), {
    status,
    headers: JSON_HEADERS,
  });
}

export function fail(code: string, message: string, status = 400): Response {
  return new Response(
    JSON.stringify({ ok: false, error: { code, message } } satisfies Envelope),
    { status, headers: JSON_HEADERS },
  );
}

// Маппинг известных серверных исключений (raise exception '...') в коды/статусы.
const KNOWN: Record<string, [string, number]> = {
  no_farm: ["no_farm", 409],
  no_street: ["no_street", 409],
  no_machine: ["no_machine", 404],
  no_seed: ["no_seed", 409],
  slot_not_empty: ["slot_busy", 409],
  recipe_locked: ["recipe_locked", 403],
  no_free_slot: ["no_free_slot", 409],
  no_stock: ["insufficient_stock", 409],
  insufficient_stock: ["insufficient_stock", 409],
  order_closed: ["order_closed", 409],
  event_closed: ["event_closed", 409],
  self_help: ["self_help", 400],
  smurf_blocked: ["smurf_blocked", 403],
  daily_cap: ["daily_cap", 429],
  bad_qty: ["bad_qty", 400],
  bad_gift: ["bad_gift", 400],
  currency_underflow: ["insufficient_funds", 402],
};

export function failFromError(err: unknown): Response {
  const raw = (err instanceof Error ? err.message : String(err)) || "error";
  // Postgres/PostgREST message может содержать префикс; ищем известный токен.
  for (const token of Object.keys(KNOWN)) {
    if (raw.includes(token)) {
      const [code, status] = KNOWN[token];
      return fail(code, raw, status);
    }
  }
  return fail("server_error", raw, 500);
}
