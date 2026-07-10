/**
 * labels.ts — RU/EN словарь HUD-строк (canon §2.3, 19-ui-ux §4.5/§7). Чистые
 * данные+геттеры, ноль логики начисления. `pick(locale)` — единая точка чтения
 * локали, чтобы компоненты не дублировали тернарники `locale === 'ru' ? … : …`.
 */

import type { Bilingual, Locale, WeekPhase, SceneKey, UiScreenKey } from '@/types'

export function pick(b: Bilingual, locale: Locale): string {
  return locale === 'ru' ? b.ru : b.en
}

/** Плашка дня (canon §2.3 таблица Пн–Вс). Формат «День · Роль». */
export const PHASE_LABEL: Record<WeekPhase, Bilingual> = {
  mon_plan: { en: 'Monday · Plan', ru: 'Понедельник · План' },
  tue_produce: { en: 'Tuesday · Produce', ru: 'Вторник · Производство' },
  wed_expedition: { en: 'Wednesday · Expedition', ru: 'Среда · Экспедиции' },
  thu_push: { en: 'Thursday · Push', ru: 'Четверг · Разгон' },
  fri_prep: { en: 'Friday · Prep', ru: 'Пятница · Прожарка' },
  sat_fair: { en: 'Saturday · Fair', ru: 'Суббота · Ярмарка' },
  sun_event: { en: 'Sunday · Event', ru: 'Воскресенье · Ивент' },
}

/** Вишнёвая (акцентная) плашка дня — суббота/воскресенье (19-ui-ux §2). */
export const ACCENT_PHASES: readonly WeekPhase[] = ['sat_fair', 'sun_event']

/** Ярлыки нижней навигации сцен (без `shift` — она вложена в Fairground). */
export const NAV_SCENE_LABEL: Record<Exclude<SceneKey, 'shift'>, Bilingual> = {
  farm: { en: 'Farm', ru: 'Ферма' },
  town: { en: 'Town', ru: 'Город' },
  fair: { en: 'Fair', ru: 'Ярмарка' },
}

export const NAV_SCENES: readonly Exclude<SceneKey, 'shift'>[] = ['farm', 'town', 'fair']

/** Заголовки оверлеев модального каркаса (19-ui-ux §3.1 S4 + новые Shell-ключи). */
const PANEL_TITLE: Partial<Record<UiScreenKey, Bilingual>> = {
  ui_notif_log: { en: 'Notifications', ru: 'Лента событий' },
}

/** Заголовок панели с безопасным фолбэком (ключ как есть — заметно в dev, не падает). */
export function panelTitle(key: UiScreenKey, locale: Locale): string {
  const b = PANEL_TITLE[key]
  return b ? pick(b, locale) : key
}

export const EMPTY_NOTIF_LOG: Bilingual = {
  en: 'A quiet day in Sunnyside',
  ru: 'Тихий день в Санисайде',
}

export const NEXT_MILESTONE_LABEL: Bilingual = { en: 'Next up', ru: 'Дальше' }
