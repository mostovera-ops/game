/**
 * ui/kitchen/RecipeCard.tsx — K3 Recipe Card (docs/specs/19-ui-ux.md §3.3 K3): деталь
 * одного рецепта. Стиль «карточка веером» (§2/§4.5): `--card` фон, mustard-заголовок,
 * список ингредиентов с источником (по каталогу), кнопка `Cook`.
 *
 * Презентационный компонент: не считает нехватку сырья сам за пределы того, что ему дают
 * (`missing`) — расчёт делает `engine/craft/chain.ts::missingInputs` (вызывающий передаёт).
 */
import type { Recipe } from '@/data/schema'
import type { Locale } from '@/types'
import type { MissingInput } from '@/engine/craft'
import { machineLabel, productLabel, type RecipeAvailability } from './catalog'
import { DINER, PRINT_SHADOW } from './tokens'

export interface RecipeCardProps {
  recipe: Recipe
  locale?: Locale
  availability: RecipeAvailability
  /** Пусто — хватает сырья на партию. Считает вызывающий (engine/craft/chain.ts). */
  missing?: MissingInput[]
  masteryStars?: number
  cookedCount?: number
  onCook?: () => void
  cooking?: boolean
}

const AVAILABILITY_LABEL: Record<RecipeAvailability, { ru: string; en: string }> = {
  unlocked: { ru: 'Открыт', en: 'Unlocked' },
  locked: { ru: 'Закрыт', en: 'Locked' },
  secret: { ru: 'Секретка', en: 'Secret' },
}

export function RecipeCard({
  recipe,
  locale = 'ru',
  availability,
  missing = [],
  masteryStars = 0,
  cookedCount,
  onCook,
  cooking = false,
}: RecipeCardProps) {
  const hidden = availability !== 'unlocked'
  const canCook = availability === 'unlocked' && missing.length === 0 && !cooking

  return (
    <div
      data-testid={`recipe-card-${recipe.key}`}
      data-availability={availability}
      className="flex w-64 flex-col gap-2 rounded-xl border p-3 text-sm"
      style={{
        background: DINER.card,
        borderColor: DINER.chrome,
        borderStyle: hidden ? 'dashed' : 'solid',
        boxShadow: PRINT_SHADOW,
        color: DINER.ink,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-black uppercase tracking-wide" style={{ color: DINER.mustard }}>
          {hidden ? '??? ' + (locale === 'ru' ? '— пока закрыто' : '— locked') : recipe.name[locale]}
        </h3>
        <span
          data-testid="recipe-availability"
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
          style={{ background: DINER.board, color: DINER.boardInk }}
        >
          {AVAILABILITY_LABEL[availability][locale]}
        </span>
      </div>

      {!hidden && (
        <>
          <div className="tabular-nums text-xs opacity-80">
            {locale === 'ru' ? 'Тир' : 'Tier'} T{recipe.tier} · {machineLabel(recipe.machineKey, locale)} ·{' '}
            {recipe.baseCraftSec}s
          </div>

          <ul className="flex flex-col gap-0.5 text-xs">
            {recipe.inputs.map((input) => {
              const short = missing.find((m) => m.key === input.key)
              return (
                <li
                  key={input.key}
                  className="flex items-center justify-between tabular-nums"
                  style={short ? { color: DINER.cherry } : undefined}
                >
                  <span>{productLabel(input.key, locale)}</span>
                  <span>
                    ×{input.qty}
                    {short ? ` (−${short.short})` : ''}
                  </span>
                </li>
              )
            })}
          </ul>

          <div className="flex items-center justify-between text-xs">
            <span>
              {'★'.repeat(masteryStars)}
              {masteryStars === 0 ? '☆' : ''}
            </span>
            {typeof cookedCount === 'number' && (
              <span className="opacity-70">
                {locale === 'ru' ? `готовили ${cookedCount} раз` : `cooked ${cookedCount}×`}
              </span>
            )}
          </div>

          <button
            type="button"
            data-testid="recipe-cook-btn"
            disabled={!canCook}
            onClick={onCook}
            className="mt-1 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: DINER.cherry }}
          >
            {cooking ? (locale === 'ru' ? 'Готовим…' : 'Cooking…') : locale === 'ru' ? 'Готовить' : 'Cook'}
          </button>
        </>
      )}
    </div>
  )
}
