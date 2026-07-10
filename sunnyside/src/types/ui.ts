/**
 * ui.ts — сцены, UI-экраны, тосты, локаль, дебаг (canon §3.12, 19-ui-ux, 21-client §3.8).
 */

/** 4 сцены-корня (21-client §3.3). Ровно один <Canvas> на активную. */
export type SceneKey = 'farm' | 'town' | 'fair' | 'shift'

export const SCENE_KEYS: readonly SceneKey[] = ['farm', 'town', 'fair', 'shift'] as const

/**
 * Реестр UI-экранов/панелей (canon §3.12).
 * `ui_notif_log` — Shell-контекст (19-ui-ux §3.1 S4 Notifications Center), пока
 * без canon-ключа (помечен `(нов.)` в спеке §4.1/§9 п.1) — ждёт PR в 00-canon.md §3.12.
 * `ui_shop` — «Shop» (19-ui-ux §4.2 навигация: «доступен из marquee-валют и Profile-меню
 * «☰», НЕ отдельная таб-иконка» → {Cosmetics · Boosters · Bundles · Dimes}). Тоже `(нов.)`
 * без явного canon-ключа (`ui_prize_machine`/`ui_route_pass` уже канон-ключи — отдельные
 * панели, открываются из Shop, но не вложены в него).
 * `ui_chat` — W3 Street Chat (19-ui-ux §3.6, 11-town §3.9/§5) — нейминг-кандидат
 * (11-town §8 п.1, ждёт PR в 00-canon.md §3.12), заведён по тому же прецеденту, что
 * `ui_notif_log`/`ui_shop` выше.
 *
 * wire-sanity (аудит смоук-проводки, после гейта C7b): ВСЕ ключи ниже смонтированы
 * (`app/PanelHost.tsx`) и достижимы из прод-UI — `PanelLauncher` (core/meta), свой
 * лаунчер (`ui_chat`/`ui_notif_log`), сцена (`ui_shift`/`ui_storage`) или контекстная
 * навигация изнутри другой панели (`ui_mailbox` — кнопкой из `ui_mail_catalog`, см.
 * `ui/mail/MailCatalog.tsx`). `ui_daily_specials`/`ui_regulars_club`/`ui_expeditions`/
 * `ui_mail_catalog`/`ui_mailbox` домонтированы параллельными профильными агентами в ходе
 * этого же гейта — на момент аудита инвариант «замонтирован ИЛИ явно помечен `v2-key,
 * не в MVP`» держится без исключений; см. e2e `e2e/shared.ts` PANELS (полный список).
 */
export type UiScreenKey =
  | 'ui_notif_log'
  | 'ui_shop'
  | 'ui_demand_board'
  | 'ui_coop_orders'
  | 'ui_recipe_box'
  | 'ui_fair_stall'
  | 'ui_shift'
  | 'ui_appetite_meter'
  | 'ui_prize_machine'
  | 'ui_neon_builder'
  | 'ui_route_pass'
  | 'ui_photo_mode'
  | 'ui_toy_shelf'
  | 'ui_ribbon_wall'
  | 'ui_postcards'
  | 'ui_daily_specials'
  | 'ui_moving_truck'
  | 'ui_regulars_club'
  | 'ui_potluck'
  | 'ui_expeditions'
  | 'ui_chat'
  // ── ui-social-misc (11-town §3.7, 16-retention §4.1, 03-animals §5, 09-fair §4.5) ──
  // Все четыре — нейминг-кандидаты уже перечисленные в спеках (не выдуманы заново,
  // AGENTS.md §0.7): `ui_mentor` (11-town §9 п.1), `ui_vacation_toggle` (16-retention
  // §4.1 таблица «Меню фермы → Уехать»), `ui_pet_card` (03-animals §5 таблица «Карточка
  // животного»), `ui_contest_gallery` (09-fair §4.5 «Contest Gallery», слаг по прецеденту
  // `PlaceholderMesh id="ui_contest_gallery_board"`, scene/fair/FairScene.tsx).
  | 'ui_mentor'
  | 'ui_vacation_toggle'
  | 'ui_pet_card'
  | 'ui_contest_gallery'
  // ── mail-catalog (08-mail-foraging §3.1.7): нейминг-кандидаты из спеки (не выдуманы,
  //    AGENTS.md §0.7) — `ui_mail_catalog` (§3.1 «экран ui_mail_catalog»), `ui_mailbox`
  //    (§3.1.3 «почтовый ящик игрока»/§3.1.7 «На пути»). ──
  | 'ui_mail_catalog'
  | 'ui_mailbox'

export const UI_SCREEN_KEYS: readonly UiScreenKey[] = [
  'ui_notif_log',
  'ui_shop',
  'ui_demand_board',
  'ui_coop_orders',
  'ui_recipe_box',
  'ui_fair_stall',
  'ui_shift',
  'ui_appetite_meter',
  'ui_prize_machine',
  'ui_neon_builder',
  'ui_route_pass',
  'ui_photo_mode',
  'ui_toy_shelf',
  'ui_ribbon_wall',
  'ui_postcards',
  'ui_daily_specials',
  'ui_moving_truck',
  'ui_regulars_club',
  'ui_potluck',
  'ui_expeditions',
  'ui_chat',
  'ui_mentor',
  'ui_vacation_toggle',
  'ui_pet_card',
  'ui_contest_gallery',
  'ui_mail_catalog',
  'ui_mailbox',
] as const

/** Локаль (canon §5 — двуязычие RU/EN). */
export type Locale = 'ru' | 'en'

/** Тост — эфемерное уведомление. НЕ персистится (21-client §3.4). Никогда не красный (P3). */
export interface Toast {
  id: string
  kind: 'info' | 'success' | 'warn'
  message: string
  createdAt: number
  ttlMs: number
}

/**
 * Запись хронологии событий (S4 Notifications Center, 19-ui-ux §3.1). Живёт в
 * `ui`-слайсе (HUD-зона), рантайм-only (не персистится — как toasts). Наполняется
 * системами по мере готовности (визиты/кооп/ивент-вехи); до тех пор — пустая лента.
 */
export interface NotificationItem {
  id: string
  kind: 'social' | 'server' | 'system'
  message: string
  createdAt: number
}

/**
 * Дебаг-параметры из query (?screen=, ?panel=, ?seed=, ?town=, ?net=, ?perf=, ?clock=).
 * Игнорируются в проде (гейт import.meta.env.DEV || e2e-flag) — 21-client §3.8.
 */
export interface DebugParams {
  screen?: SceneKey
  panel?: UiScreenKey
  seed?: number
  town?: string
  street?: string
  net?: 'offline' | 'online'
  perf?: 'lite' | 'hud'
  clock?: string // напр. sat_fair — подставить фазу недели
}

/** Индикатор перф-режима (21-client §3.9). */
export interface PerfState {
  liteMode: boolean
  showHud: boolean
  fps: number
}
