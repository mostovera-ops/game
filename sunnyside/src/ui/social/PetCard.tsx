/**
 * PetCard.tsx — карточка питомца (`ui_pet_card`, нейминг-кандидат 03-animals §5 таблица:
 * «имя, портрет, шкала Affection ★1–5, любимый корм, кнопка переименования»).
 * Переименование (`rename_pet`) + подарок-ласка (`affection_gift`, 1/животное/неделя,
 * идемпотентно на сервере — 20-backend §3.2.12/§3.4.1) через `AnimalSystem` (DI).
 */
import { useState } from 'react'
import { useStore } from '@/state'
import type { Animal, AnimalKind, ProductKey } from '@/types'
import { DINER, PRINT_SHADOW } from '../market/tokens'
import { useAnimalSystem } from './AnimalSystemContext'

/** Стабильная пустая ссылка — см. докстринг `MentorPanel.tsx` (нестабильный `?? []` в
 *  селекторе `useStore` = «Maximum update depth exceeded», React 18 `useSyncExternalStore`). */
const EMPTY_ANIMALS: Animal[] = []

const KIND_LABEL: Record<AnimalKind, { ru: string; en: string }> = {
  chicken: { ru: 'Курица', en: 'Chicken' },
  cow: { ru: 'Корова', en: 'Cow' },
  pig: { ru: 'Свинья', en: 'Pig' },
  goat: { ru: 'Коза', en: 'Goat' },
  sheep: { ru: 'Овца', en: 'Sheep' },
  bee: { ru: 'Пчёлы', en: 'Bees' },
}

/** Заполненные/пустые звёзды affection (1–5, 03-animals §3.5). */
function AffectionStars({ affection }: { affection: number }) {
  return (
    <span aria-hidden data-testid="pet-affection-stars">
      {Array.from({ length: 5 }, (_, i) => (i < affection ? '★' : '☆')).join('')}
    </span>
  )
}

function PetRow({ animal }: { animal: Animal }) {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const inventory = useStore((s) => s.inventory)
  const animals = useAnimalSystem()

  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState(animal.name ?? '')
  const [giftKey, setGiftKey] = useState<ProductKey>('')
  const [busy, setBusy] = useState<'rename' | 'gift' | null>(null)

  const giftableStacks = (inventory?.stacks ?? []).filter(
    (st) => st.qty > 0 && (st.itemClass === 'feed' || st.itemClass === 'crop' || st.itemClass === 'dish'),
  )

  async function submitRename() {
    const name = nameDraft.trim()
    if (!name) return
    setBusy('rename')
    try {
      const res = await animals.rename(animal.id, name)
      if (res.ok) setEditing(false)
    } finally {
      setBusy(null)
    }
  }

  async function submitGift() {
    if (!giftKey) return
    setBusy('gift')
    try {
      const res = await animals.gift(animal.id, giftKey)
      if (res.ok) setGiftKey('')
      else {
        useStore.getState().pushToast({
          id: `affection_gift_err_${Date.now()}`,
          kind: 'info',
          message: ru
            ? 'Уже дарили на этой неделе — попробуй в следующую.'
            : 'Already gifted this week — try again next week.',
          createdAt: Date.now(),
          ttlMs: 5000,
        })
      }
    } finally {
      setBusy(null)
    }
  }

  return (
    <li data-testid={`pet-row-${animal.id}`} className="flex flex-col gap-2 rounded-lg border border-dashed p-3" style={{ borderColor: DINER.chrome }}>
      <div className="flex items-center justify-between gap-2">
        <div>
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                data-testid={`pet-name-input-${animal.id}`}
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={24}
                className="rounded border px-2 py-0.5 text-sm"
                style={{ borderColor: DINER.chrome }}
              />
              <button
                type="button"
                data-testid={`pet-name-save-${animal.id}`}
                disabled={busy === 'rename' || !nameDraft.trim()}
                onClick={() => void submitRename()}
                className="rounded px-2 py-0.5 text-xs font-bold uppercase text-white disabled:opacity-40"
                style={{ background: DINER.teal }}
              >
                {ru ? 'Ок' : 'OK'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              data-testid={`pet-name-${animal.id}`}
              onClick={() => {
                setNameDraft(animal.name ?? '')
                setEditing(true)
              }}
              className="text-sm font-bold"
              title={ru ? 'Переименовать' : 'Rename'}
            >
              {animal.name ?? `(${ru ? KIND_LABEL[animal.kind].ru : KIND_LABEL[animal.kind].en})`} ✏️
            </button>
          )}
          <p className="text-xs opacity-70">{ru ? KIND_LABEL[animal.kind].ru : KIND_LABEL[animal.kind].en}</p>
        </div>
        <AffectionStars affection={animal.affection} />
      </div>

      <div className="flex items-center gap-2">
        {giftableStacks.length === 0 ? (
          <p className="text-xs italic opacity-60">{ru ? 'Нечего подарить.' : 'Nothing to gift.'}</p>
        ) : (
          <>
            <select
              data-testid={`pet-gift-pick-${animal.id}`}
              value={giftKey}
              onChange={(e) => setGiftKey(e.target.value)}
              className="flex-1 rounded border px-2 py-1 text-xs"
              style={{ borderColor: DINER.chrome }}
            >
              <option value="">{ru ? 'Подарок…' : 'Gift…'}</option>
              {giftableStacks.map((st) => (
                <option key={st.key} value={st.key}>
                  {st.key} ({st.qty})
                </option>
              ))}
            </select>
            <button
              type="button"
              data-testid={`pet-gift-btn-${animal.id}`}
              disabled={!giftKey || busy === 'gift'}
              onClick={() => void submitGift()}
              className="rounded-lg px-2 py-1 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-40"
              style={{ background: DINER.cherry }}
            >
              {ru ? 'Приласкать' : 'Cuddle'}
            </button>
          </>
        )}
      </div>
    </li>
  )
}

export function PetCard() {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const animals = useStore((s) => s.farm?.animals ?? EMPTY_ANIMALS)

  if (animals.length === 0) {
    return (
      <section
        data-testid="ui-pet-card"
        className="pointer-events-auto mx-auto w-full max-w-sm rounded-xl p-4"
        style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
      >
        <p data-testid="pet-card-empty" className="py-6 text-center italic opacity-70">
          {ru ? 'На ферме пока нет животных.' : 'No animals on the farm yet.'}
        </p>
      </section>
    )
  }

  return (
    <section
      data-testid="ui-pet-card"
      className="pointer-events-auto mx-auto flex w-full max-w-sm flex-col gap-2 rounded-xl p-4"
      style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
    >
      <ul className="flex flex-col gap-2" data-testid="pet-list">
        {animals.map((a) => (
          <PetRow key={a.id} animal={a} />
        ))}
      </ul>
    </section>
  )
}
