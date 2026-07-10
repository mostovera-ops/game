/**
 * Правила поведения кабана, отделённые от его отрисовки.
 *
 * Здесь нет ни three, ни кадров — только «что делать при таком расстоянии до
 * героя». Так поведение проверяется тестом, а не наблюдением за экраном:
 * подкараулить нужный кадр в браузере, чтобы увидеть испуг, — не проверка.
 */

/** На каком расстоянии кабан замечает героя. */
export const ALERT = 5.5

/**
 * На каком успокаивается. Заметно больше ALERT: с равными порогами кабан у
 * самой границы дёргался бы между бегством и прогулкой каждый кадр.
 */
export const SAFE = 11

/** Пауза между «увидел» и «побежал»: кабан вскидывает голову и разворачивается. */
export const STARTLE_SEC = 0.35

export type Mode = 'wander' | 'startle' | 'flee'

/**
 * Следующее состояние кабана.
 *
 * `startleLeft` — сколько ещё стоять столбом; в остальных состояниях не смотрим.
 * Бегство кончается по расстоянию, а не по таймеру: пока герой рядом, кабан
 * бежит, иначе он останавливался бы в двух шагах и пугался снова.
 */
export function nextMode(mode: Mode, toHero: number, startleLeft: number): Mode {
  if (mode === 'wander') return toHero < ALERT ? 'startle' : 'wander'
  if (mode === 'startle') return startleLeft <= 0 ? 'flee' : 'startle'
  return toHero > SAFE ? 'wander' : 'flee'
}

export interface Vec2 {
  x: number
  z: number
}

/** Единичный вектор «прочь от героя». Ровно под героем направление любое. */
export function awayFrom(self: Vec2, hero: Vec2): Vec2 {
  const dx = self.x - hero.x
  const dz = self.z - hero.z
  const len = Math.hypot(dx, dz)
  if (len < 1e-6) return { x: 1, z: 0 }
  return { x: dx / len, z: dz / len }
}

/**
 * Разворачивает направление бегства, если следующий шаг вынес бы за край земли.
 * Отражаем покомпонентно: кабан скользит вдоль края, а не втыкается в него.
 */
export function reflectAtEdge(dir: Vec2, nextX: number, nextZ: number, half: number): Vec2 {
  return {
    x: Math.abs(nextX) > half ? -dir.x : dir.x,
    z: Math.abs(nextZ) > half ? -dir.z : dir.z,
  }
}
