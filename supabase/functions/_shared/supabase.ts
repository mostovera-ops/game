// Клиент-фабрики. Секреты — только из env функции (никогда не хардкод).
//   SB_URL           — базовый URL проекта (fallback на авто-инжект SUPABASE_URL)
//   SB_SECRET_KEY     — sb_secret_… (service_role): обходит RLS, вызывает internal-хелперы
//   SB_PUBLISHABLE_KEY— sb_publishable_… (apikey для user-scoped вызовов RPC)
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

export function env(name: string, ...fallbacks: string[]): string {
  for (const n of [name, ...fallbacks]) {
    const v = Deno.env.get(n);
    if (v) return v;
  }
  throw new Error(`missing_env:${name}`);
}

export function projectUrl(): string {
  return env("SB_URL", "SUPABASE_URL");
}

// Админ-клиент (service_role): для internal-хелперов и Edge-логики без RLS.
export function adminClient(): SupabaseClient {
  return createClient(
    projectUrl(),
    env("SB_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

// User-scoped клиент: apikey=publishable, Authorization=JWT игрока →
// SECURITY DEFINER RPC видят корректный auth.uid() (античит: сервер знает игрока).
export function userClient(userJwt: string): SupabaseClient {
  return createClient(
    projectUrl(),
    env("SB_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${userJwt}` } },
    },
  );
}
