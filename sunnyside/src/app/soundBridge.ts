/**
 * app/soundBridge.ts — центральная звуковая шина (audio-wiring, 22-audio-visual.md
 * §3.6/§3.7/§4.4/§4.8/§7.3). Единственное место, где триггеры звука ВЫВОДЯТСЯ из состояния
 * стора (диф снапшотов, как `app/notifications.ts` для ленты уведомлений) — не через клики
 * компонентов (для тех — `ui/useSound.ts`). Здесь живут «фоновые»/системные звуковые решения,
 * которые не имеют естественной точки клика:
 *
 *  - музыкальный контекст по активной сцене + фазе дня/ночи (§3.6/§4.8), с debounce 2с
 *    смены контекста (edge case V4, §8) — не даём трекам «заикаться» при быстром тапе;
 *  - эмбиент-петля ночи (светлячки/крикеты компаньон, §4.4 «Fireflies»);
 *  - смена фазы недели → мягкий двутон-переход (`week_phase_change`);
 *  - вехи Appetite Meter → `event_milestone` (§4.4 «Meter Tick Glow»);
 *  - крафт-готово (станок доварил, ещё не собран) → `cooking_ready` — момент времени, а не
 *    клика (игрок мог отвернуться от кухни), поэтому не в `MachineQueues.tsx`;
 *  - пассивная продажа на прилавке ярмарки (лоты тают сами, 09-fair §3.2 «прилавок пассивен
 *    для всех») → `diner_cash` тихий тик;
 *  - синхронизация громкости трёх шин (`ui.volume` → `sound.ts`) и жест-разблокировка звука.
 *
 * Один общий `setInterval` (1 с — та же частота, что уже тикают таймеры кухни/смены,
 * 21-client §3.6) вместо десятка отдельных `useStore.subscribe` — дешёвый линейный скан
 * небольших списков (станки/лоты/вехи), не завязан на конкретный React-компонент, переживает
 * смену экрана. Вызывается один раз при монтировании HUD (`ui/hud/HudRoot.tsx`), возвращает
 * disposer (интервал+подписки+слушатели жеста).
 *
 * ГРАНИЦА: композиция (`src/app/**`), как `notifications.ts`/`chatBridge.ts` — читает стор
 * и системный синтез звука, не является ни engine-системой, ни ui-компонентом.
 */

import { useStore } from '@/state'
import {
  attachAutoUnlock,
  onAudioUnlocked,
  playMusicContext,
  playSfx,
  setBusVolume,
  setSoundMasterEnabled,
  startAmbientLoop,
  stopAmbientLoop,
  type MusicContext,
} from '@/assets/placeholders/sound'
import type { SceneKey, WeekPhase } from '@/types'

const POLL_MS = 1000
/** Debounce смены музыкального контекста (22-av §8 V4, гипотеза 2с). */
const MUSIC_DEBOUNCE_MS = 2000

/**
 * День/ночь по UTC серверного времени (22-av §3.6/§4.5) — НЕЗАВИСИМО от фазы недели
 * (`WeekPhase` — игровой ритуал понедельник→воскресенье, день/ночь — 24-часовой цикл
 * реального времени поверх него). Дон/сумерки огрубляем к «дню» — различаем только
 * музыкальные день/ночь-стемы (§4.8), которых всего два на ферму.
 */
export function isNightUtc(nowMs: number): boolean {
  const h = new Date(nowMs).getUTCHours()
  return h >= 19 || h < 5
}

/** Экспортирована для node-юнитов (`soundBridge.test.ts`) — чистая функция, ноль стора. */
export function desiredMusicContext(
  scene: SceneKey,
  eventFinal: boolean,
  night: boolean,
): MusicContext {
  if (eventFinal) return 'music_event_final'
  if (scene === 'shift') return 'music_shift'
  if (scene === 'fair') return 'music_fair'
  return night ? 'music_farm_night' : 'music_farm_day'
}

/**
 * Запускает звуковую шину. Идемпотентно вызывать безопасно несколько раз (каждый вызов —
 * свой независимый набор таймеров/подписок с собственным disposer'ом) — но композиция
 * должна вызвать это ровно один раз на монтирование (HudRoot useEffect, cleanup on unmount).
 */
export function initSoundBridge(): () => void {
  const detachUnlock = attachAutoUnlock()

  function syncVolumes(): void {
    const v = useStore.getState().ui.volume
    setBusVolume('music', v.music)
    setBusVolume('sfx', v.sfx)
    setBusVolume('ambient', v.ambient)
  }

  // ── Диф-состояние (замыкание — не модуль-синглтон, переживает только этот init/dispose). ──
  let phaseInitialized = false
  let lastPhase: WeekPhase | null = null
  let milestonesInitialized = false
  let lastMilestones = new Set<number>()
  let readyInitialized = false
  let lastReadyJobIds = new Set<string>()
  let lastFairRemaining: number | null = null
  let lastNight: boolean | null = null
  let currentMusic: MusicContext | null = null
  let pendingMusic: MusicContext | null = null
  let musicTimer: ReturnType<typeof setTimeout> | null = null

  // Жест мог разблокировать звук ПОСЛЕ того, как эти же вызовы уже случились немо (сборка
  // контекста произошла раньше первого клика) — «дожимаем» интонацию, которую уже выбрали.
  const detachUnlockedSync = onAudioUnlocked(() => {
    syncVolumes()
    if (currentMusic !== null) playMusicContext(currentMusic)
  })
  // Реакция на слайдеры настроек звука (immediate — не ждём следующего тика опроса).
  const unsubVolume = useStore.subscribe((s) => s.ui.volume, syncVolumes)
  // Мастер-выключатель: синк в sound.ts (выключение глушит петли немедленно); при включении
  // возобновляем текущий музыкальный контекст, который до этого выбирался «немо».
  const syncMaster = (on: boolean): void => {
    setSoundMasterEnabled(on)
    if (on) {
      syncVolumes()
      if (currentMusic !== null) playMusicContext(currentMusic)
    }
  }
  syncMaster(useStore.getState().ui.soundEnabled)
  const unsubMaster = useStore.subscribe((s) => s.ui.soundEnabled, syncMaster)

  function scheduleMusic(next: MusicContext): void {
    if (next === currentMusic) {
      // Цель совпала с уже играющим контекстом раньше, чем истёк debounce — отменяем переход.
      pendingMusic = null
      if (musicTimer !== null) {
        clearTimeout(musicTimer)
        musicTimer = null
      }
      return
    }
    if (pendingMusic === next) return
    pendingMusic = next
    if (musicTimer !== null) clearTimeout(musicTimer)
    musicTimer = setTimeout(() => {
      musicTimer = null
      if (pendingMusic !== null && pendingMusic !== currentMusic) {
        currentMusic = pendingMusic
        playMusicContext(currentMusic)
      }
    }, MUSIC_DEBOUNCE_MS)
  }

  function tick(): void {
    const s = useStore.getState()
    const now = s.serverNow()

    // ── Смена фазы недели (сначала фиксируем базовую фазу молча, потом ловим переход). ──
    const phase = s.clock.calendar?.phase ?? null
    if (!phaseInitialized) {
      lastPhase = phase
      phaseInitialized = true
    } else if (phase !== null && phase !== lastPhase) {
      playSfx('week_phase_change')
      lastPhase = phase
    }

    // ── Вехи Appetite Meter (§4.4 Meter Tick Glow). ──
    const milestonesHit = new Set(
      (s.event?.meter.milestones ?? []).filter((m) => m.hit).map((m) => m.pct),
    )
    if (!milestonesInitialized) {
      lastMilestones = milestonesHit
      milestonesInitialized = true
    } else {
      for (const pct of milestonesHit) {
        if (!lastMilestones.has(pct)) playSfx('event_milestone')
      }
      lastMilestones = milestonesHit
    }

    // ── Крафт-готово: станок пересёк дедлайн readyAt (ещё не обязательно собран). ──
    const readyIds = new Set<string>()
    for (const machine of s.farm?.machines ?? []) {
      for (const job of machine.jobs) {
        if (job.state === 'ready' || (job.state === 'cooking' && now >= job.readyAt)) {
          readyIds.add(job.id)
        }
      }
    }
    if (!readyInitialized) {
      lastReadyJobIds = readyIds
      readyInitialized = true
    } else {
      let hasNewlyReady = false
      for (const id of readyIds) {
        if (!lastReadyJobIds.has(id)) {
          hasNewlyReady = true
          break
        }
      }
      if (hasNewlyReady) playSfx('cooking_ready')
      lastReadyJobIds = readyIds
    }

    // ── Пассивная продажа на прилавке ярмарки (лоты тают сами, кассовый тик). ──
    const fairRemaining = (s.fair.stall?.lots ?? []).reduce((sum, lot) => sum + lot.remaining, 0)
    if (lastFairRemaining !== null && fairRemaining < lastFairRemaining) playSfx('diner_cash')
    lastFairRemaining = fairRemaining

    // ── Эмбиент ночи (§4.4 Fireflies, независимо от WeekPhase — реальный UTC). ──
    const night = isNightUtc(now)
    if (night !== lastNight) {
      if (night) startAmbientLoop('ambient_night')
      else stopAmbientLoop()
      lastNight = night
    }

    // ── Музыкальный контекст (§3.6/§4.8), финал ивента — сун + веха 100%. ──
    const eventFinal = phase === 'sun_event' && milestonesHit.has(100)
    const desired = desiredMusicContext(s.scene.active, eventFinal, night)
    if (currentMusic === null) {
      currentMusic = desired
      playMusicContext(desired)
    } else if (desired !== currentMusic) {
      scheduleMusic(desired)
    } else {
      pendingMusic = null
    }
  }

  tick()
  const interval = setInterval(tick, POLL_MS)

  return () => {
    clearInterval(interval)
    if (musicTimer !== null) clearTimeout(musicTimer)
    detachUnlock()
    detachUnlockedSync()
    unsubVolume()
    unsubMaster()
  }
}
