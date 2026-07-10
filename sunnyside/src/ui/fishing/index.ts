/**
 * ui/fishing — Fishing Spot мини-игра (`ui_fishing_qte`, 08-mail-foraging §3.2.4, BL-1).
 * Контекстный оверлей без Context-провайдера (не завязан ни на одну систему напрямую) —
 * `TownScene` зовёт `mailForaging.fish(hits)` сам, панель лишь отдаёт `hits` наверх.
 */
export { FishingQte } from './FishingQte'
export type { FishingQteProps } from './FishingQte'
