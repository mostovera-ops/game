/**
 * ui/shift/ShiftScreen.tsx — активная смена у прилавка (09-fair §3.4–§3.6, экран R3 19-ui-ux).
 *
 * ГЛАВНЫЙ мини-геймплей ярмарки: очередь гостей (спрайты-заглушки) → тикет заказа → сборка
 * подноса из стока кликом/тапом → «Подать». Таймер-полоса фазы, combo-каунтер, чаевые ×2,
 * авто-House Special по таймауту (провала нет, P3). Всё СЧИТАЕТ движок (`engine/fair` через
 * `./session`) — компонент только рендерит view-model и шлёт действия (AGENTS.md §0.3).
 *
 * ГРАНИЦА (AGENTS.md §3): ui/ — DOM, ноль three, ноль net. Время — `serverNow()` из стора
 * (проброшено пропом `now`, §0.4): elapsed = now() − startedAt.
 *
 * Играбельно мышью и тачем: все взаимодействия — крупные кнопки на onClick (pointer).
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { ShiftLog } from '@/types'
import type { ShiftSystem } from '@/engine/contracts'
import { dishByKey, dishByTier, type DishDef } from './pool'
import {
  currentCombo,
  currentPhase,
  currentTipMultiplier,
  elapsedFraction,
  guestPatience,
  maxCombo,
  resolveGuest,
  soldStockList,
  sweepTimeouts,
  totals,
  trayMatches,
  visibleQueue,
  type RunState,
} from './session'
import { NOOP_SHIFT_SYSTEM } from './shiftSystemFallback'
import { T, patienceColor, phaseColor } from './theme'

export interface ShiftResult {
  served: number
  fairScore: number
  bucks: number
  tips: number
  ticketsRaw: number
  maxCombo: number
}

export interface ShiftScreenProps {
  initial: RunState
  /** serverNow() (мс) на момент старта смены. */
  startedAt: number
  /** serverNow() — единственный источник игрового времени (21-client §3.6). */
  now: () => number
  onEnd: (result: ShiftResult) => void
  /**
   * Реальная `ShiftSystem` (adapter-seams, зеркалит farm-ui-seams `scene/farm/systems.tsx`) —
   * композиция (`App.tsx`) строит её один раз и прокидывает через `ShiftHost`. Без пропа —
   * тёплый no-op фолбэк (`NOOP_SHIFT_SYSTEM`): чек всё равно печатается клиентскими числами
   * («чек из движка»), но `shift_submit` не уходит на сервер.
   */
  shiftSystem?: ShiftSystem
}

const GUEST_FACES = ['🧑', '🧓', '👩', '🧔', '👵', '🧑‍🌾'] as const
const PHASE_LABEL: Record<'warmup' | 'rush' | 'last_call', string> = {
  warmup: 'Разогрев',
  rush: 'Наплыв',
  last_call: 'Последний заказ',
}

export function ShiftScreen({ initial, startedAt, now, onEnd, shiftSystem }: ShiftScreenProps) {
  const shift = shiftSystem ?? NOOP_SHIFT_SYSTEM
  const [run, setRun] = useState<RunState>(initial)
  const [nowSec, setNowSec] = useState(0)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [tray, setTray] = useState<DishDef[]>([])
  const endedRef = useRef(false)

  // Тик смены на requestAnimationFrame: elapsed из serverNow, авто-таймауты, финиш по времени.
  useEffect(() => {
    let raf = 0
    const loop = () => {
      const sec = Math.max(0, (now() - startedAt) / 1000)
      setNowSec(sec)
      setRun((prev) => sweepTimeouts(prev, sec))
      if (!endedRef.current && sec >= initial.durationSec) {
        endedRef.current = true
        void finish()
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const queue = useMemo(() => visibleQueue(run, nowSec), [run, nowSec])
  const active = useMemo(
    () => queue.find((g) => g.id === activeId) ?? queue[0],
    [queue, activeId],
  )

  // Смена активного гостя (выбор/таймаут) — сбрасываем поднос.
  const activeKey = active?.id ?? null
  useEffect(() => {
    setTray([])
  }, [activeKey])

  const live = totals(run)
  const combo = currentCombo(run)
  const tipMult = currentTipMultiplier(run)
  const phase = currentPhase(nowSec)
  const frac = elapsedFraction(run, nowSec)
  const remainingSec = Math.max(0, Math.ceil(run.durationSec - nowSec))

  /**
   * Итог смены: чек (served/combo/бакс — из движка, «чек из движка»), но НАСТОЯЩЕЕ
   * начисление — через `shift_submit` (AGENTS.md §0.3, анти-чит §3.6): шлём фактически
   * списанный сток (`soldStockList`), сервер реконструирует tips/fairScore/tickets из
   * него и правда кредитует кошелёк. Провала нет (P3) — при отказе (оффлайн/конфликт)
   * показываем клиентские числа как есть, чек всё равно печатается тёплым.
   */
  async function finish() {
    const t = totals(run)
    const shiftLog: ShiftLog = {
      seed: run.seed,
      startedAt,
      served: t.served,
      tips: t.tips,
      soldStock: soldStockList(run),
    }
    const res = await shift.submit({ shiftLog })
    const server = res.ok ? res.data : null
    onEnd({
      served: t.served,
      fairScore: server?.fairScore ?? t.fairScore,
      bucks: t.bucks,
      tips: server?.tips ?? t.tips,
      ticketsRaw: server?.tickets ?? t.ticketsRaw,
      maxCombo: maxCombo(run),
    })
  }

  function endEarly() {
    if (endedRef.current) return
    endedRef.current = true
    void finish()
  }

  function addDish(d: DishDef) {
    if (!active) return
    if (tray.length >= active.wants.qty) return
    setTray((t) => [...t, d])
  }

  function removeTrayAt(i: number) {
    setTray((t) => t.filter((_, idx) => idx !== i))
  }

  function serve() {
    if (!active) return
    if (!trayMatches(tray.map((d) => d.tier), active.dishTiers)) return
    const servedKeys = tray.map((d) => d.key)
    setRun((r) => resolveGuest(r, active.id, 'normal', servedKeys))
    setTray([])
    setActiveId(null)
  }

  const canServe = !!active && trayMatches(tray.map((d) => d.tier), active.dishTiers)
  const bigCombo = combo >= 10

  return (
    <div
      data-testid="shift-screen"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: 'auto',
        fontFamily: '"Courier New", ui-monospace, monospace',
        color: T.ink,
        background: 'rgba(20,16,12,0.35)',
        userSelect: 'none',
      }}
    >
      {/* ── Верхняя панель: таймер фазы + счётчики ── */}
      <div style={{ padding: 12, background: T.cream, boxShadow: `0 2px 8px ${T.shadow}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{ fontWeight: 900, letterSpacing: 1 }}>СМЕНА · {PHASE_LABEL[phase]}</span>
          <span data-testid="shift-timer" style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
            ⏱ {remainingSec}s
          </span>
          <button
            data-testid="shift-end"
            onClick={endEarly}
            style={btnStyle(T.chromeDark, T.ink)}
          >
            Закончить
          </button>
        </div>

        {/* Полоса-таймер (цвет фазы) */}
        <div style={{ height: 10, background: T.chrome, borderRadius: 6, overflow: 'hidden' }}>
          <div
            style={{
              width: `${frac * 100}%`,
              height: '100%',
              background: phaseColor(phase),
              transition: 'width 120ms linear',
            }}
          />
        </div>

        {/* Счётчики: combo / tips-mult / деньги / очки */}
        <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Badge testid="shift-combo" bg={bigCombo ? T.neonPink : T.chrome} fg={T.ink}>
            Серия ×{combo}
          </Badge>
          <Badge testid="shift-tipmult" bg={bigCombo ? T.neonYellow : T.chrome} fg={T.ink}>
            {bigCombo ? '⚡ ×2 TIPS!' : `Чаевые ×${tipMult}`}
          </Badge>
          <Badge bg={T.good} fg="#fff">💵 ${live.bucks}</Badge>
          <Badge bg={T.mustard} fg={T.ink}>🪙 Чаевые ${live.tips}</Badge>
          <Badge bg={T.ribbon} fg="#fff">★ {live.fairScore}</Badge>
          <Badge bg={T.chrome} fg={T.ink}>Подано {live.served}</Badge>
        </div>
      </div>

      {/* ── Очередь гостей ── */}
      <div style={{ padding: '10px 12px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {queue.length === 0 && (
            <span style={{ color: T.cream, opacity: 0.8 }}>Очередь пуста — гости подходят…</span>
          )}
          {queue.map((g, i) => {
            const p = guestPatience(g, nowSec)
            const isActive = g.id === active?.id
            return (
              <button
                key={g.id}
                data-testid="shift-guest"
                onClick={() => setActiveId(g.id)}
                style={{
                  ...guestCardStyle(isActive),
                  borderColor: isActive ? T.cherry : 'transparent',
                }}
              >
                <PatienceRing remaining={p} />
                <div style={{ fontSize: 30, lineHeight: 1 }}>
                  {g.vip ? '🎩' : GUEST_FACES[i % GUEST_FACES.length]}
                </div>
                {g.vip && <div style={{ fontSize: 10, color: T.ribbon, fontWeight: 800 }}>VIP</div>}
                <OrderBubble guest={g} pool={run.pool} />
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* ── Активный заказ + поднос ── */}
      <div style={{ background: T.cream, padding: 12, boxShadow: `0 -2px 8px ${T.shadow}` }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Тикет активного заказа */}
          <div style={{ minWidth: 160 }}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>Заказ</div>
            <div data-testid="shift-ticket" style={ticketStyle}>
              {active ? (
                active.dishTiers.map((tier, i) => {
                  const want =
                    i === 0
                      ? dishByKey(run.pool, active.wants.dishKey) ?? dishByTier(run.pool, tier)
                      : dishByTier(run.pool, tier)
                  return (
                    <span key={i} style={{ fontSize: 24 }} title={want?.label}>
                      {want?.emoji ?? '🍽'}
                    </span>
                  )
                })
              ) : (
                <span style={{ color: T.inkSoft }}>—</span>
              )}
            </div>
          </div>

          {/* Поднос */}
          <div style={{ minWidth: 160 }}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>Поднос</div>
            <div data-testid="shift-tray" style={{ ...ticketStyle, background: T.paper }}>
              {tray.length === 0 && <span style={{ color: T.inkSoft }}>пусто</span>}
              {tray.map((d, i) => (
                <button
                  key={i}
                  onClick={() => removeTrayAt(i)}
                  title="Убрать"
                  style={{ ...chipBtn(d.color), fontSize: 22 }}
                >
                  {d.emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Подать */}
          <button
            data-testid="shift-serve"
            onClick={serve}
            disabled={!canServe}
            style={{
              ...btnStyle(canServe ? T.cherry : T.chromeDark, '#fff'),
              alignSelf: 'stretch',
              minWidth: 120,
              fontSize: 18,
              cursor: canServe ? 'pointer' : 'default',
              opacity: canServe ? 1 : 0.7,
            }}
          >
            Подать ▸
          </button>
        </div>

        {/* Сток готовых блюд */}
        <div style={{ fontWeight: 800, margin: '10px 0 4px' }}>Готовый сток</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {run.pool.map((d) => (
            <button
              key={d.key}
              data-testid="shift-stock"
              onClick={() => addDish(d)}
              style={{ ...chipBtn(d.color), display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span style={{ fontSize: 22 }}>{d.emoji}</span>
              <span style={{ fontSize: 11 }}>{d.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Мелкие презентационные части ─────────────────────────────────────────────

function Badge({
  children,
  bg,
  fg,
  testid,
}: {
  children: ReactNode
  bg: string
  fg: string
  testid?: string
}) {
  return (
    <span
      data-testid={testid}
      style={{
        background: bg,
        color: fg,
        padding: '3px 10px',
        borderRadius: 999,
        fontWeight: 800,
        fontSize: 13,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

function PatienceRing({ remaining }: { remaining: number }) {
  const r = 16
  const c = 2 * Math.PI * r
  const col = patienceColor(remaining)
  return (
    <svg width={40} height={40} style={{ position: 'absolute', top: 2, right: 2 }}>
      <circle cx={20} cy={20} r={r} fill="none" stroke="#00000022" strokeWidth={3} />
      <circle
        cx={20}
        cy={20}
        r={r}
        fill="none"
        stroke={col}
        strokeWidth={3}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - remaining)}
        strokeLinecap="round"
        transform="rotate(-90 20 20)"
      />
    </svg>
  )
}

function OrderBubble({ guest, pool }: { guest: { dishTiers: number[]; wants: { dishKey: string } }; pool: DishDef[] }) {
  return (
    <div
      style={{
        marginTop: 4,
        background: '#fff',
        borderRadius: 8,
        padding: '2px 6px',
        display: 'flex',
        gap: 2,
        boxShadow: `0 1px 3px ${T.shadow}`,
      }}
    >
      {guest.dishTiers.map((tier, i) => {
        const d =
          i === 0
            ? dishByKey(pool, guest.wants.dishKey) ?? dishByTier(pool, tier)
            : dishByTier(pool, tier)
        return (
          <span key={i} style={{ fontSize: 15 }}>
            {d?.emoji ?? '🍽'}
          </span>
        )
      })}
    </div>
  )
}

// ── Стили ────────────────────────────────────────────────────────────────────

function btnStyle(bg: string, fg: string): CSSProperties {
  return {
    background: bg,
    color: fg,
    border: 'none',
    borderRadius: 10,
    padding: '8px 14px',
    fontWeight: 800,
    fontFamily: 'inherit',
    cursor: 'pointer',
    boxShadow: `0 2px 0 ${T.shadow}`,
  }
}

function chipBtn(color: string): CSSProperties {
  return {
    background: '#fff',
    border: `2px solid ${color}`,
    borderRadius: 10,
    padding: '6px 8px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    color: T.ink,
  }
}

const ticketStyle: CSSProperties = {
  minHeight: 44,
  background: '#fff',
  border: `1px dashed ${T.chromeDark}`,
  borderRadius: 8,
  padding: 8,
  display: 'flex',
  gap: 6,
  alignItems: 'center',
  flexWrap: 'wrap',
}

function guestCardStyle(active: boolean): CSSProperties {
  return {
    position: 'relative',
    minWidth: 92,
    background: active ? T.neonYellow : T.paper,
    border: '3px solid transparent',
    borderRadius: 12,
    padding: '10px 8px 8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: `0 2px 6px ${T.shadow}`,
  }
}
