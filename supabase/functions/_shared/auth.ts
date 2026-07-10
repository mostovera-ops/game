// Аутентификация вызова игрока. Валидны только запросы с JWT игрока
// (Supabase Auth). Возвращаем uid + сам JWT (для user-scoped RPC-форвардинга).
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface Caller {
  uid: string;
  jwt: string;
}

export function bearer(req: Request): string | null {
  const h = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

// Проверяет JWT через admin.auth.getUser и возвращает uid.
export async function requireUser(
  admin: SupabaseClient,
  req: Request,
): Promise<Caller> {
  const jwt = bearer(req);
  if (!jwt) throw new Error("unauthorized:no_bearer");
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data?.user) throw new Error("unauthorized:bad_jwt");
  return { uid: data.user.id, jwt };
}
