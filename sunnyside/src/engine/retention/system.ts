/**
 * engine/retention/system.ts — фабрика системы удержания (16-retention.md).
 *
 * Реализует сетевую поверхность, объявленную в `engine/contracts.ts`:
 *   - `streakCheck`/`streakInsure` — те же сигнатуры, что в `ProgressionSystem`
 *     (Regular Streak — часть прогрессии игрока с точки зрения контракта; здесь —
 *     реализация владельца механики retention, AGENTS.md §2 «профильный агент
 *     по системе»);
 *   - `vacationStart`/`vacationEnd` — те же сигнатуры, что в `BackendAdapter`.
 *
 * Паттерн — как `collections/system.ts`: локальная валидация ДО сети (анти-чит,
 * ничего не начисляет сама) → `ctx.applyMutation` → сервер — истина. Локальные
 * предсказания (бонус %, цена страховки, допустимость длительности отпуска) —
 * чистые функции `./streak` и `./vacation`, вызывающая сторона (UI/стор) использует
 * их ДО отправки мутации, чтобы показать «примерно N» без ожидания ответа сервера.
 */

import type { SystemContext } from '@/engine/contracts'
import type { RpcResult, StreakCheckRes, StreakInsureRes, VacationRes } from '@/types'
import { validateVacationStart, type ValidateVacationStartInput } from './vacation'

/** Поверхность стрика/отпуска, которую предоставляет модуль retention (см. докстринг файла). */
export interface RetentionSystem {
  streakCheck(): Promise<RpcResult<StreakCheckRes>>
  streakInsure(): Promise<RpcResult<StreakInsureRes>>
  vacationStart(input: ValidateVacationStartInput): Promise<RpcResult<VacationRes>>
  vacationEnd(): Promise<RpcResult<VacationRes>>
}

function fail<T>(code: 'invalid_payload', message: string): RpcResult<T> {
  return { ok: false, error: { code, message } }
}

/** Фабрика системы удержания (владелец: agent «retention», AGENTS.md §2). */
export function createRetentionSystem(ctx: SystemContext): RetentionSystem {
  return {
    async streakCheck(): Promise<RpcResult<StreakCheckRes>> {
      return ctx.applyMutation<StreakCheckRes>('streak_check', {})
    },

    async streakInsure(): Promise<RpcResult<StreakInsureRes>> {
      return ctx.applyMutation<StreakInsureRes>('streak_insure', {})
    },

    async vacationStart(input: ValidateVacationStartInput): Promise<RpcResult<VacationRes>> {
      const validated = validateVacationStart(input)
      if (!validated.ok) {
        return fail('invalid_payload', `vacationStart: ${validated.error}`)
      }
      return ctx.applyMutation<VacationRes>('vacation_start', { days: validated.value.days })
    },

    async vacationEnd(): Promise<RpcResult<VacationRes>> {
      return ctx.applyMutation<VacationRes>('vacation_end', {})
    },
  }
}
