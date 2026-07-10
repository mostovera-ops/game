/**
 * ui/shop/PaymentDialog.tsx — dev-эмуляция платёжного шлюза (задание зоны
 * `ui-shop-pass`: «ПЛАТЕЖИ — ЗАГЛУШКА: кнопка «купить» открывает dev-диалог
 * «эмуляция платежа OK/FAIL» (реальный биллинг вне скоупа)»).
 *
 * Каждая кнопка «Купить» в Shop/Route Pass/Prize Machine/Boosters/Bundles сначала
 * идёт сюда — это единственная точка, которая решает, продолжать ли реальный вызов
 * системы (`useShopSystems()`) или остановиться. На FAIL ничего не списывается и не
 * начисляется (система вообще не вызывается) — так же, как настоящий отказ платёжного
 * провайдера НЕ доходит до `BackendAdapter.iapVerify`/`applyMutation`.
 *
 * `usePaymentEmulation()` — императивный promise-based confirm (`await confirm(label)`),
 * без стора: диалог живёт как локальный React-стейт хука, не персистится, не нужен
 * глобальный слайс ради модалки одного экрана (в отличие от `ui.activePanel`, который
 * управляет ВЛОЖЕННОСТЬЮ панелей — этот диалог рисуется ПОВЕРХ уже открытой панели
 * магазина, а не заменяет её).
 */
import { useCallback, useRef, useState } from 'react'
import { useStore } from '@/state'
import { DINER, PRINT_SHADOW } from './tokens'

interface PendingPayment {
  label: string
  priceLabel: string
}

export interface PaymentEmulation {
  /** Открывает dev-диалог; резолвится `true` на OK, `false` на FAIL/закрытие. */
  confirm: (label: string, priceLabel: string) => Promise<boolean>
  Dialog: () => JSX.Element | null
}

export function usePaymentEmulation(): PaymentEmulation {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const [pending, setPending] = useState<PendingPayment | null>(null)
  const resolveRef = useRef<((ok: boolean) => void) | null>(null)

  const confirm = useCallback((label: string, priceLabel: string) => {
    setPending({ label, priceLabel })
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  const settle = useCallback((ok: boolean) => {
    resolveRef.current?.(ok)
    resolveRef.current = null
    setPending(null)
  }, [])

  const Dialog = useCallback(() => {
    if (!pending) return null
    return (
      <div
        data-testid="dev-payment-dialog"
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
        onClick={() => settle(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          className="hud-receipt w-full max-w-xs rounded-[var(--radius-diner)] p-4"
          style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-1 text-xs uppercase tracking-wide opacity-60">
            {ru ? 'Dev · эмуляция платежа' : 'Dev · payment emulation'}
          </p>
          <p className="mb-3 text-sm font-bold">{pending.label}</p>
          <p className="mb-4 text-lg font-black tabular-nums" style={{ color: DINER.cherry }}>
            {pending.priceLabel}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              data-testid="dev-payment-ok"
              onClick={() => settle(true)}
              className="flex-1 rounded-lg px-3 py-2 text-sm font-bold uppercase tracking-wide text-white"
              style={{ background: DINER.teal }}
            >
              OK
            </button>
            <button
              type="button"
              data-testid="dev-payment-fail"
              onClick={() => settle(false)}
              className="flex-1 rounded-lg px-3 py-2 text-sm font-bold uppercase tracking-wide text-white"
              style={{ background: DINER.cherry }}
            >
              FAIL
            </button>
          </div>
          <p className="mt-3 text-center text-[10px] opacity-50">
            {ru ? 'реальный биллинг вне скоупа' : 'real billing out of scope'}
          </p>
        </div>
      </div>
    )
  }, [pending, ru, settle])

  return { confirm, Dialog }
}
