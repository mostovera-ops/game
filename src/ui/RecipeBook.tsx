/**
 * Книга рецептов — модалка по клавише B.
 *
 * Показывает все блюда мира, а не только освоенные: закрытая страница с
 * подсказкой «найдите гриб в лесу» — это цель, ради которой игрок пойдёт в лес.
 * Спрятать её целиком значило бы не дать ему повода туда идти.
 *
 * Открытость держит HUD в useState, а не стор: это состояние экрана.
 * Список знакомых рецептов, наоборот, персистится — он и есть прогресс.
 */
import { useEffect } from 'react'
import {
  FORAGE_RECIPE,
  RECIPES,
  RECIPE_IDS,
  useGameStore,
  type ForageId,
  type ItemId,
  type RecipeId,
} from '../game/store'
import { FORAGE_HINT, ITEM_EMOJI, ITEM_NAME, RECIPE_EMOJI, RECIPE_NAME } from './crops'

/** Какая находка открывает этот рецепт, если он вообще из находок. */
function unlockedBy(recipe: RecipeId): ForageId | null {
  const pair = (Object.keys(FORAGE_RECIPE) as ForageId[]).find((f) => FORAGE_RECIPE[f] === recipe)
  return pair ?? null
}

function KnownRecipe({ recipe }: { recipe: RecipeId }) {
  const inventory = useGameStore((s) => s.inventory)
  const { needs, price } = RECIPES[recipe]

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-white/5 p-3">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{RECIPE_EMOJI[recipe]}</span>
        <span className="text-sm font-bold">{RECIPE_NAME[recipe]}</span>
        <span className="ml-auto text-sm font-bold text-[#f4b942]">{price}💰</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(needs) as ItemId[]).map((item) => {
          const need = needs[item] ?? 0
          const have = inventory[item]
          return (
            <span
              key={item}
              title={ITEM_NAME[item]}
              className={`flex items-center gap-1 rounded bg-black/20 px-2 py-1 text-xs ${
                have >= need ? 'opacity-80' : 'text-[#ff8b5e]'
              }`}
            >
              {ITEM_EMOJI[item]} ×{need}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function LockedRecipe({ recipe }: { recipe: RecipeId }) {
  const forage = unlockedBy(recipe)
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-white/15 bg-black/20 p-3">
      <div className="flex items-center gap-2">
        <span className="text-2xl grayscale">❓</span>
        <span className="text-sm font-bold opacity-40">Неизвестный рецепт</span>
      </div>
      <span className="text-xs leading-relaxed opacity-50">
        {forage ? FORAGE_HINT[forage] : 'Рецепт ещё предстоит открыть'}
      </span>
    </div>
  )
}

export function RecipeBook({ onClose }: { onClose: () => void }) {
  const knownRecipes = useGameStore((s) => s.knownRecipes)

  // Escape закрывает; B ловится в HUD, чтобы одна клавиша и открывала, и закрывала.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const openCount = knownRecipes.length

  return (
    <div
      onClick={onClose}
      className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-[#241a33]/70"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-[34rem] max-w-[92vw] flex-col gap-4 rounded-xl border-2 border-[#f4b942] bg-[#241a20] p-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#f4b942]">
            Книга рецептов
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xs opacity-50">
              открыто {openCount} из {RECIPE_IDS.length}
            </span>
            <button
              onClick={onClose}
              className="rounded px-2 py-0.5 text-xs opacity-60 transition hover:opacity-100"
            >
              B / Esc ✕
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {RECIPE_IDS.map((recipe) =>
            knownRecipes.includes(recipe) ? (
              <KnownRecipe key={recipe} recipe={recipe} />
            ) : (
              <LockedRecipe key={recipe} recipe={recipe} />
            ),
          )}
        </div>

        <p className="text-[10px] leading-relaxed opacity-40">
          Новые блюда приходят из леса: подберите находку — и рецепт откроется сам.
        </p>
      </div>
    </div>
  )
}
