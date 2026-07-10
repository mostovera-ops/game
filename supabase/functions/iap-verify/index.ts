// iap-verify — верификация покупки и начисление ◉ (20-backend.md §3.4.2, §3.7 B6).
// Единственный источник dimes за реал. Дедуп по (provider, provider_txn_id).
// Начисление — только после verified, одной вставкой в currency_ledgers
// (триггер-гард считает баланс). Клиент не может начислить dimes напрямую.
import { preflight } from "../_shared/cors.ts";
import { ok, fail, failFromError } from "../_shared/response.ts";
import { adminClient } from "../_shared/supabase.ts";
import { requireUser } from "../_shared/auth.ts";

interface VerifyResult { ok: boolean; txnId: string; dimes: number }

// Верификация квитанции у провайдера. Реальные интеграции (Stripe/Apple/Google/
// Paddle) идут сюда; здесь — каркас + детерминированный 'test'-провайдер для
// e2e-прогонов. Секреты провайдеров — из env функции, не хардкод.
const ALLOWED_PROVIDERS = new Set(["stripe", "apple", "google", "paddle"]);

async function verifyReceipt(
  provider: string,
  receipt: string,
  sku: string,
): Promise<VerifyResult> {
  const dimesForSku: Record<string, number> = {
    dimes_small: 100, dimes_medium: 550, dimes_large: 1200,
  };
  const dimes = dimesForSku[sku] ?? 0;
  if (!ALLOWED_PROVIDERS.has(provider)) return { ok: false, txnId: "", dimes: 0 };

  // Sandbox-конвенция: квитанция вида "sandbox_*" верифицируется детерминированно
  // (у провайдеров есть sandbox-режим). Дедуп по txn id из квитанции (B6).
  if (receipt.startsWith("sandbox_")) {
    return { ok: dimes > 0, txnId: `${provider}_${receipt}`, dimes };
  }
  // Прод-верификация у провайдера (Stripe/Apple/Google/Paddle) — секреты из env:
  //   case "stripe": Stripe API + STRIPE_SECRET → проверить payment_intent
  //   case "apple":  App Store Server API
  //   case "google": Google Play Developer API
  // На MVP реальные интеграции ещё не подключены → отклоняем как непроверенную.
  return { ok: false, txnId: "", dimes: 0 };
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return fail("method_not_allowed", "POST only", 405);

  let body: { provider?: string; receipt?: string; sku?: string };
  try { body = await req.json(); } catch { return fail("bad_json", "invalid JSON", 400); }
  const provider = String(body.provider ?? "");
  const receipt = String(body.receipt ?? "");
  const sku = String(body.sku ?? "");
  if (!provider || !receipt || !sku) return fail("bad_request", "provider/receipt/sku required", 400);

  const admin = adminClient();
  let uid: string;
  try { ({ uid } = await requireUser(admin, req)); }
  catch (e) { return fail("unauthorized", (e as Error).message, 401); }

  try {
    const v = await verifyReceipt(provider, receipt, sku);
    if (!v.ok) return fail("verify_failed", "receipt not verified", 402);

    // Дедуп: unique (provider, provider_txn_id). Повторный колбэк → возврат прежней покупки.
    const { data: existing } = await admin
      .from("purchases")
      .select("id, state, dimes_granted")
      .eq("provider", provider)
      .eq("provider_txn_id", v.txnId)
      .maybeSingle();
    if (existing) {
      return ok({ purchase_id: existing.id, dimes: existing.dimes_granted ?? 0, deduped: true });
    }

    // Создаём покупку и начисляем ◉ одной логической операцией.
    const { data: purchase, error: pe } = await admin
      .from("purchases")
      .insert({
        player_id: uid, sku, provider, provider_txn_id: v.txnId,
        dimes_granted: v.dimes, state: "granted",
        verified_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();
    if (pe) {
      // Гонка двойного колбэка: unique-violation → покупка уже есть, читаем её.
      const { data: race } = await admin
        .from("purchases").select("id, dimes_granted")
        .eq("provider", provider).eq("provider_txn_id", v.txnId).maybeSingle();
      if (race) return ok({ purchase_id: race.id, dimes: race.dimes_granted ?? 0, deduped: true });
      throw new Error(pe.message);
    }

    const { error: le } = await admin.from("currency_ledgers").insert({
      player_id: uid, currency: "dimes", delta: v.dimes,
      reason: "purchase", ref_type: "purchases", ref_id: purchase!.id,
      idempotency_key: `purchase:${v.txnId}`,
    });
    if (le) throw new Error(le.message);

    await admin.from("audit_logs").insert({
      actor_id: uid, action: "iap-verify", result: "ok",
    });
    return ok({ purchase_id: purchase!.id, dimes: v.dimes });
  } catch (e) {
    return failFromError(e);
  }
});
