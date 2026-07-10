/**
 * ui/chat/catalog.ts — Emote Stickers, 12 базовых (11-town §3.9, гипотеза; заглушка —
 * реестр ассетов `ui_emote_sticker_pack`, `src/assets/placeholders/registry.ts`, финал —
 * PNG-атлас 12×128×128 в стиле 50-х). До прихода финального арта (Фаза D, AGENTS.md §5)
 * рисуем эмодзи-глиф вместо иконки — тот же приём, что magenta-маркер `PlaceholderMesh`
 * для 3D, только для 2D DOM-чата (ui/ не имеет собственного 3D-заглушечного пайплайна).
 *
 * Список — гипотеза наравне с остальными числами спеки: 7 примеров из 11-town §3.9
 * дословно (`sk_pie`…`sk_grand_opening`) + 5 доп. в том же тоне «дружелюбный дайнер»,
 * чтобы набрать канонические «12 базовых». Финальный набор/канон-ключи — через PR в
 * `00-canon.md` (см. `11-town.md §8 п.1`, как и сам `ui_chat`).
 */

import type { Bilingual } from '@/types'

export interface EmoteSticker {
  /** Рабочий ключ (не canon — кандидат, см. докстринг). */
  key: string
  glyph: string
  label: Bilingual
}

export const EMOTE_STICKERS: readonly EmoteSticker[] = [
  { key: 'sk_pie', glyph: '🥧', label: { en: 'pie', ru: 'пирог' } },
  { key: 'sk_nice_sign', glyph: '🌟', label: { en: 'nice sign!', ru: 'классная вывеска!' } },
  { key: 'sk_thanks_neighbor', glyph: '🤝', label: { en: 'thanks neighbor', ru: 'спасибо, сосед' } },
  { key: 'sk_count_me_in', glyph: '🎟', label: { en: 'count me in', ru: 'я в деле' } },
  { key: 'sk_yum', glyph: '🍒', label: { en: 'yum', ru: 'вкуснотища' } },
  { key: 'sk_on_my_way', glyph: '🚚', label: { en: 'on my way', ru: 'уже еду' } },
  { key: 'sk_grand_opening', glyph: '🎉', label: { en: 'grand opening!', ru: 'открытие!' } },
  { key: 'sk_hi_neighbor', glyph: '👋', label: { en: 'hi neighbor', ru: 'привет, сосед' } },
  { key: 'sk_fresh_crop', glyph: '🌽', label: { en: 'fresh crop', ru: 'свежий урожай' } },
  { key: 'sk_great_harvest', glyph: '🔥', label: { en: 'great harvest', ru: 'отличный сбор' } },
  { key: 'sk_gone_fishin', glyph: '🎣', label: { en: 'gone fishin’', ru: 'на рыбалке' } },
  { key: 'sk_see_you_fair', glyph: '🎡', label: { en: 'see you at the fair', ru: 'до встречи на ярмарке' } },
] as const
