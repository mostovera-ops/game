// Идемпотентность мутаций по request_id (20-backend.md §3.4/§4.3).
// Гард — таблица public.idempotency (scope,key) PK, поле result (text) хранит
// сериализованный ответ для реплея. Каждый игрок изолирован (uid в ключе).
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface IdemResult<T> {
  data: T;
  replayed: boolean;
}

// Захват ключа: true = первый раз (можно выполнять), false = дубликат.
async function claim(
  admin: SupabaseClient,
  scope: string,
  key: string,
): Promise<boolean> {
  const { data, error } = await admin.rpc("claim_idem", {
    p_scope: scope,
    p_key: key,
  });
  if (error) throw new Error(`idem_claim_failed:${error.message}`);
  return data === true;
}

async function readResult(
  admin: SupabaseClient,
  scope: string,
  key: string,
): Promise<string | null> {
  const { data } = await admin
    .from("idempotency")
    .select("result")
    .eq("scope", scope)
    .eq("key", key)
    .maybeSingle();
  return data?.result ?? null;
}

// Выполняет fn ровно один раз для (scope,key). Повторный request_id → кэш.
export async function withIdem<T>(
  admin: SupabaseClient,
  scope: string,
  key: string,
  fn: () => Promise<T>,
): Promise<IdemResult<T>> {
  const first = await claim(admin, scope, key);
  if (!first) {
    // Дубликат: ждём/читаем сохранённый результат.
    const cached = await readResult(admin, scope, key);
    if (cached) return { data: JSON.parse(cached) as T, replayed: true };
    // Гонка двух одинаковых запросов до записи результата — мягкий дубль.
    return { data: { duplicate: true } as unknown as T, replayed: true };
  }
  try {
    const out = await fn();
    await admin
      .from("idempotency")
      .update({ result: JSON.stringify(out) })
      .eq("scope", scope)
      .eq("key", key);
    return { data: out, replayed: false };
  } catch (e) {
    // При ошибке освобождаем ключ, чтобы клиент мог ретраить осмысленно.
    await admin.from("idempotency").delete().eq("scope", scope).eq("key", key);
    throw e;
  }
}
