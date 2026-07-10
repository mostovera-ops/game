/**
 * engine/clock/constants.ts — каноничные константы серверного календаря.
 *
 * Все якоря — в UTC (canon §2.3, 01-core-loop §4.1). Сервер без DST-сдвигов:
 * якоря считаются от абсолютного эпох-времени, поэтому переход на летнее время
 * в стране игрока НИКОГДА не двигает окна (C6). Клиент лишь переводит UTC-якорь
 * в локальную «подачу».
 *
 * ЧИСЛА — ИЗ СПЕКИ (01-core-loop §4.1/§4.2, прошли ревью), не выдуманы.
 * ГРАНИЦА: ноль импортов three / react / net. Чистые числа.
 */

// ── Базовые длительности ──
export const SECOND_MS = 1_000
export const MINUTE_MS = 60_000
export const HOUR_MS = 3_600_000
export const DAY_MS = 86_400_000
/** Реальная неделя = игровой цикл (canon §2.3). */
export const WEEK_MS = 7 * DAY_MS // 604_800_000

/**
 * Эпоха Unix (1970-01-01T00:00:00Z) — четверг. Первый понедельник 00:00 UTC —
 * 1970-01-05 (сдвиг +4 суток). От этого якоря нарезаются серверные недели, чтобы
 * `WEEK_START` всегда попадал ровно на Пн 00:00 UTC (canon §2.3, `WEEK_START`).
 */
export const WEEK_EPOCH_ANCHOR = 4 * DAY_MS // 345_600_000

// ── Смещения якорей от начала недели (Пн 00:00 UTC) ──
/** A5 · Co-op Orders дедлайн — Чт 23:59:59 UTC (canon §2.3, `COOP_DEADLINE`). */
export const COOP_DEADLINE_OFFSET =
  3 * DAY_MS + 23 * HOUR_MS + 59 * MINUTE_MS + 59 * SECOND_MS
/** A8 · Открытие ярмарки — Сб 00:00:00 UTC (canon §2.3, `FAIR_OPEN`). */
export const FAIR_OPEN_OFFSET = 5 * DAY_MS
/** Ширина окна ярмарки — 36 ч (canon §2.3, `FAIR_WINDOW_HOURS`). */
export const FAIR_WINDOW_HOURS = 36
export const FAIR_WINDOW_MS = FAIR_WINDOW_HOURS * HOUR_MS // 129_600_000
/** A10 · Закрытие ярмарки — Вс 12:00:00 UTC (Сб 00:00 + 36 ч; canon `FAIR_CLOSE`). */
export const FAIR_CLOSE_OFFSET = FAIR_OPEN_OFFSET + FAIR_WINDOW_MS
/** A12 · Финал ивента — Вс 20:00:00 UTC круглогодично (canon §2.3, DECISIONS-B K7). */
export const EVENT_FINALE_OFFSET = 6 * DAY_MS + 20 * HOUR_MS
/** A14 · Rollover недели — Вс 23:59:59 UTC (canon §2.3, `WEEK_ROLLOVER`). */
export const ROLLOVER_OFFSET = WEEK_MS - SECOND_MS

// ── Мягкие («гипотеза») якоря/под-дедлайны недели (§3.2, §4.2) ──
// Не идемпотентные джобы (§4.5 — те только жёсткие A0/A5/A10/A12/A14), а флейвор-тики
// и под-дедлайны конкурсов; UI-отсчёт (§4.3) использует их наравне с жёсткими якорями.
/** A1 · Радио-анонс спроса (WSUN) — Пн 00:05 UTC (§4.2, гипотеза). */
export const DEMAND_PUBLISH_OFFSET = 5 * MINUTE_MS
/** A7 · Hype-тик «завтра ярмарка!» — Пт 12:00 UTC (§4.2, гипотеза). */
export const PREP_HYPE_TICK_OFFSET = 4 * DAY_MS + 12 * HOUR_MS
/** A9 · Дедлайн приёма конкурсных заявок — Сб 12:00 UTC (12 ч от A8; §4.2, гипотеза). */
export const CONTEST_SUBMIT_CLOSE_OFFSET = FAIR_OPEN_OFFSET + 12 * HOUR_MS
/** Дедлайн голосования конкурсов совпадает с закрытием ярмарки (Вс 12:00, A10, §4.2). */
export const CONTEST_VOTE_CLOSE_OFFSET = FAIR_CLOSE_OFFSET
/** A11 · Публикация результатов конкурсов — Вс 12:05 UTC (§4.2, гипотеза). */
export const RESULTS_PUBLISH_OFFSET = FAIR_CLOSE_OFFSET + 5 * MINUTE_MS
/** «Тихий вечер» стартует одновременно с финалом ивента (§4.2, гипотеза = A12). */
export const QUIET_EVENING_START_OFFSET = EVENT_FINALE_OFFSET

// ── Сезоны / Route Pass ──
/** Длина сезона — 8 недель, фиксировано (FIXPLAN R7, §3.8/§4.4). */
export const SEASON_LENGTH_WEEKS = 8
/** Ровно один сезонный тик за завершённую неделю (§3.7 R3, §4.4). */
export const PASS_TICKS_PER_SEASON = SEASON_LENGTH_WEEKS
/** Межсезонная нейтральная неделя без тика паса (§3.8, гипотеза — открытый вопрос #3). */
export const INTERSEASON_GAP_WEEKS = 1
/** Льготный период возврата наград сезона после его конца (§3.8 C10, гипотеза). */
export const SEASON_REWARD_GRACE_H = 72
export const SEASON_REWARD_GRACE_MS = SEASON_REWARD_GRACE_H * HOUR_MS

// ── Tutorial Mini-Week (§3.9/§4.2) ──
/** Целевая суммарная длительность мини-недели новичка (канон E8; §4.2, гипотеза). */
export const TUTORIAL_TOTAL_MIN = 20

// ── Grand Opening (§3.10; econ — мастер множителя, 14-economy §3.10 R1) ──
/** ×2 к доходу (canon §3.13 `mech_grand_opening`). Мастер множителя — 14-economy. */
export const GRAND_OPENING_MULT = 2
/** Фиксированный таймер 7×24 ч от входа, переживает rollover (FIXPLAN R1, §3.10). */
export const GRAND_OPENING_DAYS = 7
export const GRAND_OPENING_MS = GRAND_OPENING_DAYS * DAY_MS

// ── Синхронизация часов (§3.3) ──
/** Число сэмплов get_server_time для медианы serverOffset (21-client §3.6). */
export const CLOCK_SAMPLE_COUNT = 3
