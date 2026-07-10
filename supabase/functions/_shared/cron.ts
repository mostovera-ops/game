// Общий каркас cron/оркестрационных Edge-функций.
// Авторизация — общий секрет CRON_SECRET (заголовок x-cron-secret), который
// знают только pg_cron (через private.edge_config) и сама функция. Никогда не
// хардкодится: значение приходит из секрета функции. Тело обычно пустое —
// функция сама итерирует по всем городам внутри SQL-джоба.
import { preflight } from "./cors.ts";
import { ok, fail, failFromError } from "./response.ts";
import { adminClient, env } from "./supabase.ts";

export function cronAuthorized(req: Request): boolean {
  const provided = req.headers.get("x-cron-secret") ?? "";
  let expected = "";
  try {
    expected = env("CRON_SECRET");
  } catch {
    return false;
  }
  // Постоянное сравнение длины + значения (защита от timing — некритично, но дёшево).
  if (!provided || provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

// Оборачивает вызов SQL-джоба: аутентификация → admin.rpc(jobFn, args) → конверт.
export function serveJob(jobFn: string) {
  return async (req: Request): Promise<Response> => {
    const pre = preflight(req);
    if (pre) return pre;
    if (req.method !== "POST") return fail("method_not_allowed", "POST only", 405);
    if (!cronAuthorized(req)) return fail("forbidden", "bad cron secret", 403);

    let args: Record<string, unknown> = {};
    try {
      const raw = await req.text();
      if (raw) args = JSON.parse(raw);
    } catch { /* пустое тело допустимо */ }

    try {
      const admin = adminClient();
      const { data, error } = await admin.rpc(jobFn, args);
      if (error) throw new Error(error.message);
      return ok(data);
    } catch (e) {
      return failFromError(e);
    }
  };
}
