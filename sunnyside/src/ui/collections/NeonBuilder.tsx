/**
 * ui/collections/NeonBuilder.tsx — C8 Neon Builder (docs/specs/19-ui-ux.md §3.7 C8,
 * 17-collections §2.7/§3.7): конструктор вывески дайнера — буквы (до 3 строк ×14
 * симв.), пиктограммы, цвета неона, анимация; `Save` шлёт `neon_save` через
 * `CollectionSystem.saveNeon` (engine/contracts.ts) — сервер хранит `player_neon_sign`,
 * этот компонент не персистит конфиг сам (AGENTS.md §0.3/§0.5).
 *
 * ГРАНИЦА (AGENTS.md §3): фактический рендер вывески «над фермой» (3D-модель на
 * фасаде дайнера, LOD-значок на карте города) — обязанность scene-агента(ов)
 * `scene/farm`/`scene/town`, читающих `collections.neonSign` из стора (см.
 * `state/collections.ts` setNeonSign). Здесь — только редактор + CSS-превью
 * «как будет светиться» (живой предпросмотр §3.7 таблица, не 3D-рендер сцены).
 */
import { useMemo, useState } from 'react'
import { useStore } from '@/state'
import type { NeonAnimationKey, NeonSignConfig } from '@/types'
import { useCollectionSystem } from './CollectionSystemContext'
import { DINER, NEON_COLORS, PRINT_SHADOW } from './tokens'

const MAX_LINES = 3
const MAX_CHARS = 14

const BASE_PICTOGRAMS = ['star', 'arrow', 'coffee_cup', 'cow', 'burger', 'plate'] as const
const PREMIUM_PICTOGRAMS = [
  'moon',
  'sun',
  'car',
  'donut',
  'pie',
  'chicken',
  'milk_bottle',
  'gas_pump',
  'guitar',
  'jukebox',
  'palm_tree',
  'boot',
] as const

const PICTOGRAM_LABEL: Record<string, { ru: string; en: string }> = {
  star: { ru: 'звезда', en: 'star' },
  arrow: { ru: 'стрелка', en: 'arrow' },
  coffee_cup: { ru: 'чашка кофе', en: 'coffee cup' },
  cow: { ru: 'корова', en: 'cow' },
  burger: { ru: 'бургер', en: 'burger' },
  plate: { ru: 'тарелка', en: 'plate' },
  moon: { ru: 'луна', en: 'moon' },
  sun: { ru: 'солнце', en: 'sun' },
  car: { ru: 'машина', en: 'car' },
  donut: { ru: 'пончик', en: 'donut' },
  pie: { ru: 'пирог', en: 'pie' },
  chicken: { ru: 'курица', en: 'chicken' },
  milk_bottle: { ru: 'бутылка молока', en: 'milk bottle' },
  gas_pump: { ru: 'бензоколонка', en: 'gas pump' },
  guitar: { ru: 'гитара', en: 'guitar' },
  jukebox: { ru: 'джукбокс', en: 'jukebox' },
  palm_tree: { ru: 'пальма', en: 'palm tree' },
  boot: { ru: 'сапог', en: 'boot' },
}

const ANIMATION_LABEL: Record<NeonAnimationKey, { ru: string; en: string; free: boolean }> = {
  steady: { ru: 'Постоянное свечение', en: 'Steady glow', free: true },
  blink: { ru: 'Мигание', en: 'Blink', free: true },
  chase: { ru: 'Бегущая волна', en: 'Chase', free: false },
}

function defaultConfig(): NeonSignConfig {
  return { lines: ['SUNNYSIDE'], pictogramIds: [], colorIds: ['cherry_red'], animation: 'steady' }
}

export interface NeonBuilderProps {
  onClose?: () => void
  onSaved?: () => void
}

export function NeonBuilder({ onClose, onSaved }: NeonBuilderProps) {
  const locale = useStore((s) => s.ui.locale)
  const saved = useStore((s) => s.collections?.neonSign ?? null)
  const setNeonSign = useStore((s) => s.setNeonSign)
  const system = useCollectionSystem()

  const [config, setConfig] = useState<NeonSignConfig>(() => saved ?? defaultConfig())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allPictograms = useMemo(() => [...BASE_PICTOGRAMS, ...PREMIUM_PICTOGRAMS], [])

  function updateLine(idx: number, value: string) {
    const clipped = value.slice(0, MAX_CHARS).toUpperCase()
    setConfig((c) => {
      const lines = [...c.lines]
      lines[idx] = clipped
      return { ...c, lines }
    })
  }

  function addLine() {
    setConfig((c) => (c.lines.length >= MAX_LINES ? c : { ...c, lines: [...c.lines, ''] }))
  }

  function removeLine(idx: number) {
    setConfig((c) => ({ ...c, lines: c.lines.filter((_, i) => i !== idx) }))
  }

  function togglePictogram(id: string) {
    setConfig((c) => ({
      ...c,
      pictogramIds: c.pictogramIds.includes(id) ? c.pictogramIds.filter((p) => p !== id) : [...c.pictogramIds, id],
    }))
  }

  function toggleColor(id: string) {
    setConfig((c) => ({
      ...c,
      colorIds: c.colorIds.includes(id) ? c.colorIds.filter((p) => p !== id) : [...c.colorIds, id],
    }))
  }

  async function save() {
    setSaving(true)
    setError(null)
    const res = await system.saveNeon(config as unknown as Record<string, unknown>)
    setSaving(false)
    if (!res.ok) {
      setError(res.error.message)
      return
    }
    setNeonSign(config)
    onSaved?.()
  }

  return (
    <section
      data-testid="neon-builder"
      className="flex max-h-[80vh] w-full max-w-3xl flex-col gap-3 overflow-hidden rounded-2xl p-4"
      style={{ background: DINER.paper }}
    >
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-black uppercase tracking-wide" style={{ color: DINER.board }}>
          {locale === 'ru' ? 'Неон-конструктор' : 'Neon Builder'}
        </h2>
        {onClose && (
          <button
            type="button"
            data-testid="neon-builder-close"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-sm font-bold"
            style={{ background: DINER.board, color: DINER.boardInk }}
          >
            {locale === 'ru' ? 'Закрыть' : 'Close'}
          </button>
        )}
      </header>

      {/* Живое CSS-превью — не 3D-рендер сцены, см. докстринг файла. */}
      <div
        data-testid="neon-preview"
        className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 p-6"
        style={{ background: '#0c1116', borderColor: DINER.chrome, boxShadow: PRINT_SHADOW }}
      >
        {config.lines.map((line, i) => (
          <p
            key={i}
            className="font-black uppercase tracking-widest"
            style={{
              color: NEON_COLORS[config.colorIds[0] ?? 'cherry_red']?.hex ?? '#FF3B5C',
              textShadow: `0 0 6px ${NEON_COLORS[config.colorIds[0] ?? 'cherry_red']?.hex ?? '#FF3B5C'}, 0 0 16px ${NEON_COLORS[config.colorIds[0] ?? 'cherry_red']?.hex ?? '#FF3B5C'}`,
              animation: config.animation === 'blink' ? 'neon-blink 1.6s infinite' : undefined,
              fontSize: '1.5rem',
            }}
          >
            {line || '·'.repeat(3)}
          </p>
        ))}
        <p className="mt-1 text-xs" style={{ color: DINER.chrome }}>
          {config.pictogramIds.map((p) => PICTOGRAM_LABEL[p]?.[locale] ?? p).join(' · ')}
        </p>
      </div>

      <div>
        <h3 className="font-black uppercase" style={{ color: DINER.board }}>
          {locale === 'ru' ? 'Текст (до 3 строк)' : 'Text (up to 3 lines)'}
        </h3>
        <div className="flex flex-col gap-1">
          {config.lines.map((line, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                data-testid={`neon-line-${i}`}
                value={line}
                maxLength={MAX_CHARS}
                onChange={(e) => updateLine(i, e.target.value)}
                className="rounded-lg border px-2 py-1 text-xs uppercase"
                style={{ borderColor: DINER.chrome, background: DINER.card, color: DINER.ink }}
              />
              <button
                type="button"
                data-testid={`neon-line-remove-${i}`}
                onClick={() => removeLine(i)}
                className="rounded-full px-2 py-1 text-[10px] font-bold text-white"
                style={{ background: DINER.cherry }}
              >
                {locale === 'ru' ? 'Убрать' : 'Remove'}
              </button>
            </div>
          ))}
          {config.lines.length < MAX_LINES && (
            <button
              type="button"
              data-testid="neon-line-add"
              onClick={addLine}
              className="w-fit rounded-lg px-2 py-1 text-[11px] font-bold uppercase text-white"
              style={{ background: DINER.teal }}
            >
              {locale === 'ru' ? '+ строка' : '+ line'}
            </button>
          )}
        </div>
      </div>

      <div>
        <h3 className="font-black uppercase" style={{ color: DINER.board }}>
          {locale === 'ru' ? 'Пиктограммы' : 'Pictograms'}
        </h3>
        <div className="flex flex-wrap gap-2">
          {allPictograms.map((p) => {
            const isPremium = (PREMIUM_PICTOGRAMS as readonly string[]).includes(p)
            const active = config.pictogramIds.includes(p)
            return (
              <button
                key={p}
                type="button"
                data-testid={`neon-pictogram-${p}`}
                aria-pressed={active}
                onClick={() => togglePictogram(p)}
                className="rounded-full px-3 py-1 text-xs font-bold"
                style={{
                  background: active ? DINER.cherry : DINER.card,
                  color: active ? 'white' : DINER.ink,
                  border: `1px solid ${DINER.chrome}`,
                }}
              >
                {PICTOGRAM_LABEL[p]?.[locale] ?? p}
                {isPremium && ' ◉'}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <h3 className="font-black uppercase" style={{ color: DINER.board }}>
          {locale === 'ru' ? 'Цвет неона' : 'Neon color'}
        </h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(NEON_COLORS).map(([id, def]) => (
            <button
              key={id}
              type="button"
              data-testid={`neon-color-${id}`}
              aria-pressed={config.colorIds.includes(id)}
              onClick={() => toggleColor(id)}
              className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold"
              style={{
                background: config.colorIds.includes(id) ? def.hex : DINER.card,
                color: config.colorIds.includes(id) ? '#111' : DINER.ink,
                border: `1px solid ${DINER.chrome}`,
              }}
            >
              {id}
              {!def.free && ' ◉'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-black uppercase" style={{ color: DINER.board }}>
          {locale === 'ru' ? 'Анимация' : 'Animation'}
        </h3>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ANIMATION_LABEL) as NeonAnimationKey[]).map((k) => (
            <button
              key={k}
              type="button"
              data-testid={`neon-animation-${k}`}
              aria-pressed={config.animation === k}
              onClick={() => setConfig((c) => ({ ...c, animation: k }))}
              className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
              style={{
                background: config.animation === k ? DINER.cherry : DINER.card,
                color: config.animation === k ? 'white' : DINER.ink,
                border: `1px solid ${DINER.chrome}`,
              }}
            >
              {ANIMATION_LABEL[k][locale]}
              {!ANIMATION_LABEL[k].free && ' ◉'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p data-testid="neon-builder-error" className="text-xs" style={{ color: DINER.cherry }}>
          {error}
        </p>
      )}

      <button
        type="button"
        data-testid="neon-builder-save"
        onClick={save}
        disabled={saving}
        className="w-fit self-end rounded-lg px-4 py-2 text-xs font-bold uppercase text-white disabled:opacity-50"
        style={{ background: DINER.teal }}
      >
        {saving ? (locale === 'ru' ? 'Сохраняем…' : 'Saving…') : locale === 'ru' ? 'Повесить' : 'Save'}
      </button>
    </section>
  )
}
