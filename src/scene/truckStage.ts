/**
 * Геометрия дня торговли: где окно фудтрака, где стоит герой и где очередь.
 *
 * Пропс — food_truck_open.glb: габариты и посадка у него от старого food_truck,
 * зато есть настоящий проём окна, интерьер и створка отдельным узлом `Hatch`.
 * Грузовик стоит наискось (rotationY ≈ 53°) и уменьшен до 0.711 — те же цифры,
 * что были у старого пропса в scene-layout.json.
 *
 * Поэтому «перёд кузова» по мировым осям не угадывается, и всё здесь считается
 * от одной точки: берём локальную точку модели, масштабируем, поворачиваем на
 * курс грузовика и прибавляем его позицию. Локальные числа печатает
 * tools/_export_food_truck_open.py — они в осях glTF и до масштаба.
 *
 * Держим это здесь, а не в компонентах: и Hero, и Customers, и створка считают
 * от одной точки, и разъехаться им нельзя.
 */
import * as THREE from 'three'

/** Инстанс пропса в scene-layout.json: позиция, курс, масштаб. */
export const TRUCK = new THREE.Vector3(1.8441, 0, -5.8892)
const TRUCK_ROT = 0.9268585
const TRUCK_SCALE = 0.710829

// --- локальные точки модели (glTF, до масштаба) ---------------------------
const LOCAL_SERVE_X = -0.7925 // середина проёма по оси кузова
const LOCAL_FACE_Z = 0.72 // передняя стенка — плоскость окна
const LOCAL_HERO_Z = 0.22 // герой вглубь от неё
const LOCAL_FLOOR_Y = 0.9 // пол кузова: он высоко, грузовик на больших колёсах

/**
 * Низ туловища героя в hero.glb: HeroBody начинается на этой высоте, ниже
 * только ноги. Ставя героя в кузов, мы прячем ноги и опускаем его на столько,
 * чтобы туловище встало на пол.
 */
const HERO_BODY_BOTTOM = 0.442

const UP = new THREE.Vector3(0, 1, 0)

/** Локальная точка пропса → мировая. */
function toWorld(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, z)
    .multiplyScalar(TRUCK_SCALE)
    .applyAxisAngle(UP, TRUCK_ROT)
    .add(TRUCK)
}

/** Куда смотрит окно раздачи: локальная +Z, повёрнутая курсом грузовика. */
export const FACE_DIR = new THREE.Vector3(0, 0, 1).applyAxisAngle(UP, TRUCK_ROT)

/** Середина проёма на плоскости окна — от неё строится очередь. */
const FACE = toWorld(LOCAL_SERVE_X, 0, LOCAL_FACE_Z)

/**
 * Герой внутри фудтрака, лицом к очереди. В день 7 он не идёт сюда пешком —
 * он тут с самого начала дня (см. Hero.tsx): кузов закрыт, дверь со стороны
 * кабины вне кадра, и разыгрывать вход было бы враньём.
 */
export const HERO_SEAT = toWorld(LOCAL_SERVE_X, LOCAL_FLOOR_Y, LOCAL_HERO_Z).setY(
  LOCAL_FLOOR_Y * TRUCK_SCALE - HERO_BODY_BOTTOM,
)

/** Первый в очереди — за прилавком; остальные за ним, прочь от окна. */
export const QUEUE_HEAD = FACE.clone().addScaledVector(FACE_DIR, 0.62)

/** Шаг между клиентами в очереди. */
export const QUEUE_STEP = 0.85

/** Откуда клиенты приходят: сбоку, из-за деревьев. */
export const SPAWN = QUEUE_HEAD.clone()
  .addScaledVector(FACE_DIR, 1.6)
  .addScaledVector(new THREE.Vector3(FACE_DIR.z, 0, -FACE_DIR.x), 3.6)

/** Место i-го в очереди. */
export function queueSpot(i: number, out = new THREE.Vector3()): THREE.Vector3 {
  return out.copy(QUEUE_HEAD).addScaledVector(FACE_DIR, i * QUEUE_STEP)
}

/**
 * Угол открытой створки: поворот узла `Hatch` вокруг локального X. Ноль —
 * закрыта (так она лежит в GLB). Значение из того же скрипта экспорта.
 */
export const HATCH_OPEN = THREE.MathUtils.degToRad(-120)

/** Насколько резво створка идёт к своему положению; ≈1 c на весь ход. */
export const HATCH_LAMBDA = 3.2

/**
 * Герой в кузове ростом со своих клиентов, но без ног: интерьер ниже его
 * полного роста, а ноги всё равно за прилавком. Узлы hero.glb, которые прячем.
 */
export const HERO_LEG_NODES = ['HeroLegL', 'HeroLegR'] as const

/** Куда смотреть, чтобы видеть точку (dx, dz). Модель глядит на −Z. */
export function yawTo(dx: number, dz: number): number {
  return Math.atan2(-dx, -dz)
}

/** Герой в окне смотрит на очередь. */
export const HERO_YAW = yawTo(FACE_DIR.x, FACE_DIR.z)

/** Клиент, дошедший до места, разворачивается к окну. */
export const QUEUE_YAW = yawTo(-FACE_DIR.x, -FACE_DIR.z)
