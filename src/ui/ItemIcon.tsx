/**
 * Значок предмета в HUD.
 *
 * Почти у всех это эмодзи, но у гриба своего эмодзи нет: 🍄 — мухомор, а в игре
 * собирают боровик. Составное 🍄‍🟫 рисуется одним глифом только там, где шрифт
 * знает эту склейку (Apple), а иначе распадается на мухомор и коричневый
 * квадрат. Поэтому гриб рисуем сами — заодно он повторяет тот, что растёт в
 * лесу: коричневая шапка без единой точки.
 *
 * Размер задаётся шрифтом: значок занимает 1em, как и эмодзи рядом с ним.
 */
import type { ItemId } from '../game/store'
import { ITEM_EMOJI } from './crops'

// Те же цвета, что у mushroom.glb в palette.json. game/ и ui/ ассетов не
// читают, поэтому дубль — как HERO_COLOR_DEFAULT в сторе.
const CAP = '#7a5334'
const STEM = '#e6d6b8'

/** Боровик: широкая коричневая шапка и толстая ножка. */
function Mushroom({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      {/* Ножка книзу толще — без утолщения гриб читается поганкой. */}
      <path d="M9.4 11h5.2l.7 7.6c.06.7-.3 1.2-.9 1.5-1.5.7-3.3.7-4.8 0-.6-.3-.96-.8-.9-1.5z" fill={STEM} />
      <path d="M12 2.6c5.2 0 9 3.5 9 7.2 0 1-.8 1.7-1.9 1.7H4.9C3.8 11.5 3 10.8 3 9.8c0-3.7 3.8-7.2 9-7.2z" fill={CAP} />
    </svg>
  )
}

export function ItemIcon({ item, className = '' }: { item: ItemId; className?: string }) {
  if (item === 'mushroom') {
    return <Mushroom className={`inline-block h-[1em] w-[1em] align-[-0.15em] ${className}`} />
  }
  return <span className={className}>{ITEM_EMOJI[item]}</span>
}
