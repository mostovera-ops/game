/**
 * Мимика героя: моргание, гримасы и взгляд за курсором.
 *
 * Отдельно от Hero.tsx, потому что ходьба и лицо — разные механизмы, и оба
 * тикают каждый кадр. Здесь только чистая математика поз; узлы модели
 * (HeroPupilL/R, HeroLidTopL/R, HeroLidBotL/R) приходят снаружи.
 *
 * Все три части глаза сидят origin'ом в центре глазного яблока (см.
 * tools/_export_hero.py), поэтому любое движение — поворот вокруг origin.
 *
 * Поза покоя век снята с самих узлов, а не задана константой: её знает GLB,
 * и второй копии в коде быть не должно.
 */
import * as THREE from 'three'
import { POSES, type Expression } from './heroFace'

/** Один глаз: три узла и запомненная поза покоя век. */
export interface Eye {
  pupil: THREE.Object3D
  top: THREE.Object3D
  bottom: THREE.Object3D
  topRest: number
  bottomRest: number
  /** Центр яблока в системе группы героя — из позиции узла зрачка. */
  center: THREE.Vector3
  /** +1 левый глаз (на +X модели), −1 правый. Зеркалит наклон век. */
  sign: number
}

/** Куда смотрит зрачок: не дальше этого угла от «прямо перед собой». */
const GAZE_LIMIT = 0.42 // рад ≈ 24°
const GAZE_LAMBDA = 9 // как резво зрачок догоняет курсор
const LID_LAMBDA = 22 // веки: быстрее взгляда, иначе моргание вязкое

/** Моргание: пауза между морганиями и длительность самого моргания. */
const BLINK_MIN = 2.2
const BLINK_MAX = 6.5
const BLINK_SEC = 0.14

export function collectEyes(model: THREE.Object3D): Eye[] {
  const eyes: Eye[] = []
  for (const [suffix, sign] of [
    ['L', 1],
    ['R', -1],
  ] as const) {
    const pupil = model.getObjectByName(`HeroPupil${suffix}`)
    const top = model.getObjectByName(`HeroLidTop${suffix}`)
    const bottom = model.getObjectByName(`HeroLidBot${suffix}`)
    if (!pupil || !top || !bottom) continue

    // Порядок углов важен. Веко: сперва опускаем (X), потом наклоняем линию
    // вокруг оси взгляда (Z) — «ZYX» даёт ровно Rz·Rx. Обратный порядок кренит
    // купол до опускания, и злой глаз выходит косым, а не прищуренным.
    top.rotation.order = 'ZYX'
    bottom.rotation.order = 'ZYX'
    // Зрачок: сначала вверх-вниз (X), затем вбок (Y) — как настоящий глаз.
    pupil.rotation.order = 'YXZ'

    eyes.push({
      pupil,
      top,
      bottom,
      topRest: top.rotation.x,
      bottomRest: bottom.rotation.x,
      center: pupil.position.clone(),
      sign,
    })
  }
  return eyes
}

/** Часы моргания: сколько глаз закрыт прямо сейчас, 0 — открыт, 1 — сомкнут. */
export class Blinker {
  private next = BLINK_MIN
  private elapsed = 0
  /** Тик. Возвращает степень смыкания [0..1]. */
  step(dt: number): number {
    this.elapsed += dt
    const since = this.elapsed - this.next
    if (since > BLINK_SEC) {
      this.elapsed = 0
      // Интервал случайный: ритмичное моргание выглядит механическим.
      this.next = BLINK_MIN + Math.random() * (BLINK_MAX - BLINK_MIN)
      return 0
    }
    if (since < 0) return 0
    // Треугольник: вниз до конца и обратно.
    const t = since / BLINK_SEC
    return 1 - Math.abs(t * 2 - 1)
  }
}

/**
 * Куда смотреть: точка под курсором на уровне глаз.
 *
 * Пересекаем луч камеры с горизонтальной плоскостью на высоте глаз. Курсор в
 * небе луча не пересекает — тогда взгляд остаётся там, где был, и герой не
 * закатывает глаза каждый раз, когда мышь ушла за горизонт.
 */
const plane = new THREE.Plane()
const hit = new THREE.Vector3()
const ray = new THREE.Raycaster()

export function gazeTarget(
  pointer: THREE.Vector2,
  camera: THREE.Camera,
  eyeWorldY: number,
  out: THREE.Vector3,
): boolean {
  ray.setFromCamera(pointer, camera)
  plane.set(new THREE.Vector3(0, 1, 0), -eyeWorldY)
  if (!ray.ray.intersectPlane(plane, hit)) return false
  out.copy(hit)
  return true
}

const local = new THREE.Vector3()
const dir = new THREE.Vector3()

/**
 * Ставит оба глаза: зрачки на цель, веки в позу выражения + моргание.
 *
 * `target` — точка взгляда в мировых координатах, `group` — узел героя (по
 * нему переводим цель в локальные координаты, иначе поворот тела уводил бы
 * взгляд вместе с собой).
 */
export function applyEyes(
  eyes: Eye[],
  group: THREE.Object3D,
  target: THREE.Vector3 | null,
  expression: Expression,
  blink: number,
  dt: number,
) {
  const pose = POSES[expression]
  // Моргание перекрывает гримасу: во время моргания веки идут в ноль независимо
  // от того, злился герой или радовался.
  const top = Math.max(pose.top, blink)
  const bottom = Math.max(pose.bottom, blink)

  if (target) group.worldToLocal(local.copy(target))

  for (const eye of eyes) {
    if (target) {
      dir.copy(local).sub(eye.center)
      // Модель смотрит на −Z: yaw и pitch считаем от этой оси.
      const yaw = Math.atan2(-dir.x, -dir.z)
      const pitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z))
      eye.pupil.rotation.y = THREE.MathUtils.damp(
        eye.pupil.rotation.y,
        THREE.MathUtils.clamp(yaw, -GAZE_LIMIT, GAZE_LIMIT),
        GAZE_LAMBDA,
        dt,
      )
      eye.pupil.rotation.x = THREE.MathUtils.damp(
        eye.pupil.rotation.x,
        THREE.MathUtils.clamp(pitch, -GAZE_LIMIT, GAZE_LIMIT),
        GAZE_LAMBDA,
        dt,
      )
    }

    // lid = 0 → поза покоя из GLB, lid = 1 → край века на центре глаза.
    for (const [node, rest, lid] of [
      [eye.top, eye.topRest, top],
      [eye.bottom, eye.bottomRest, bottom],
    ] as const) {
      node.rotation.x = THREE.MathUtils.damp(node.rotation.x, rest * (1 - lid), LID_LAMBDA, dt)
      node.rotation.z = THREE.MathUtils.damp(
        node.rotation.z,
        pose.roll * eye.sign,
        LID_LAMBDA,
        dt,
      )
    }
  }
}
