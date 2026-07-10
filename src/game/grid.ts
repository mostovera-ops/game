/**
 * Сетка двора. Чистая арифметика, НОЛЬ импортов из three (см. CLAUDE.md).
 *
 * Клетка 0.5 м выбрана не наугад: слот посадки — ровно одна клетка, а грядка —
 * три клетки в ряд. Значит подсветка клетки под курсором и есть подсветка
 * слота, и отдельная геометрия хитбоксов не нужна.
 *
 * Клетка (gx, gz) занимает [gx·CELL, (gx+1)·CELL) по обеим осям. Начало
 * координат — угол клетки, а не её центр: дом 3×3 м это ровно 6×6 клеток, и он
 * садится на (0,0) симметрично. Пропс с нечётной стороной центрируется на
 * центре клетки, с чётной — на линии сетки; и то, и другое попадает в сетку.
 *
 * Размещение хранит МИНИМАЛЬНЫЙ УГОЛ занятого прямоугольника, а не центр.
 * Тогда поворот — это обмен w и d местами, а занятые клетки считаются целыми
 * числами, без округления полуклеток. Центр для рендера выводится из угла.
 */

/** Сторона клетки в метрах. */
export const CELL = 0.5

/** Поворот четвертями оборота. rot·90° вокруг Y. */
export type Rot = 0 | 1 | 2 | 3

/** Размер пропса в клетках. */
export interface Footprint {
  w: number
  d: number
}

export interface Cell {
  gx: number
  gz: number
}

/** Где и как повёрнуто. Размер берётся из каталога по типу объекта. */
export interface Placed {
  gx: number
  gz: number
  rot: Rot
}

/**
 * Двор — прямоугольник клеток, внутри которого игрок волен строить. Границы
 * включительные.
 *
 * Лес снаружи остаётся органическим: деревья, посаженные по линейке, выглядят
 * не лесом, а плантацией. Два дерева, стоящих внутри двора, сетку не ломают —
 * их клетки просто заняты, как заняты клетки дома.
 *
 * x ∈ [−7, 7], z ∈ [−4, 4] — 28×16 клеток. Лавка семян (z ≈ 5) и фудтрак
 * (z ≈ −5.9) остались снаружи намеренно: их двигать нельзя.
 */
export const YARD = { gx0: -14, gz0: -8, gx1: 13, gz1: 7 } as const

/** Размер после поворота: нечётные четверти меняют стороны местами. */
export function rotatedSize(fp: Footprint, rot: Rot): Footprint {
  return rot % 2 === 0 ? { w: fp.w, d: fp.d } : { w: fp.d, d: fp.w }
}

/** Центр клетки в мировых координатах (X, Z). */
export function cellCenter(gx: number, gz: number): { x: number; z: number } {
  return { x: (gx + 0.5) * CELL, z: (gz + 0.5) * CELL }
}

/** Клетка, в которую попала мировая точка. */
export function worldToCell(x: number, z: number): Cell {
  return { gx: Math.floor(x / CELL), gz: Math.floor(z / CELL) }
}

/** Центр всего размещения — туда сцена ставит меш. */
export function placementCenter(p: Placed, fp: Footprint): { x: number; z: number } {
  const s = rotatedSize(fp, p.rot)
  return { x: (p.gx + s.w / 2) * CELL, z: (p.gz + s.d / 2) * CELL }
}

/** Угол поворота меша вокруг Y, радианы. */
export function rotationY(rot: Rot): number {
  return (rot * Math.PI) / 2
}

/**
 * Куда уезжает локальная клетка (lx, lz) внутри пропса при повороте.
 * Возвращает смещение от угла размещения, уже в повёрнутых осях.
 *
 * Локальные координаты считаются до поворота, в собственном (w × d) пропса.
 * Формулы — обычный поворот индексов; проверять их удобнее тестом на слотах
 * грядки, чем глазами по матрице.
 */
export function rotateLocal(fp: Footprint, rot: Rot, lx: number, lz: number): Cell {
  switch (rot) {
    case 0:
      return { gx: lx, gz: lz }
    case 1:
      return { gx: fp.d - 1 - lz, gz: lx }
    case 2:
      return { gx: fp.w - 1 - lx, gz: fp.d - 1 - lz }
    case 3:
      return { gx: lz, gz: fp.w - 1 - lx }
  }
}

/** Мировая клетка локальной клетки пропса. */
export function localToCell(p: Placed, fp: Footprint, lx: number, lz: number): Cell {
  const r = rotateLocal(fp, p.rot, lx, lz)
  return { gx: p.gx + r.gx, gz: p.gz + r.gz }
}

/** Все клетки, которые размещение занимает. */
export function placementCells(p: Placed, fp: Footprint): Cell[] {
  const s = rotatedSize(fp, p.rot)
  const out: Cell[] = []
  for (let dx = 0; dx < s.w; dx++) {
    for (let dz = 0; dz < s.d; dz++) out.push({ gx: p.gx + dx, gz: p.gz + dz })
  }
  return out
}

/** Ключ клетки для Set/Map. */
export function cellKey(gx: number, gz: number): string {
  return `${gx},${gz}`
}

/** Целиком ли размещение внутри двора. */
export function inYard(p: Placed, fp: Footprint): boolean {
  const s = rotatedSize(fp, p.rot)
  return (
    p.gx >= YARD.gx0 &&
    p.gz >= YARD.gz0 &&
    p.gx + s.w - 1 <= YARD.gx1 &&
    p.gz + s.d - 1 <= YARD.gz1
  )
}

/** Пересекаются ли два размещения. */
export function overlaps(a: Placed, aFp: Footprint, b: Placed, bFp: Footprint): boolean {
  const sa = rotatedSize(aFp, a.rot)
  const sb = rotatedSize(bFp, b.rot)
  return (
    a.gx < b.gx + sb.w && b.gx < a.gx + sa.w && a.gz < b.gz + sb.d && b.gz < a.gz + sa.d
  )
}

/**
 * Клетки по периметру размещения — те, откуда до него можно дотянуться.
 * Диагонали не в счёт: герой ходит по земле, а не по углам.
 */
export function ringCells(p: Placed, fp: Footprint): Cell[] {
  const s = rotatedSize(fp, p.rot)
  const out: Cell[] = []
  for (let dx = 0; dx < s.w; dx++) {
    out.push({ gx: p.gx + dx, gz: p.gz - 1 })
    out.push({ gx: p.gx + dx, gz: p.gz + s.d })
  }
  for (let dz = 0; dz < s.d; dz++) {
    out.push({ gx: p.gx - 1, gz: p.gz + dz })
    out.push({ gx: p.gx + s.w, gz: p.gz + dz })
  }
  return out
}

/**
 * Можно ли поставить пропс сюда.
 *
 * `blocked` — клетки, занятые чем угодно: другими размещениями, домом,
 * деревьями. Клетки самого перемещаемого пропса в него класть не нужно, иначе
 * грядка не сможет сдвинуться на клетку и будет мешать сама себе.
 *
 * Мало не пересечься: к грядке ещё надо подойти. Требуем хотя бы одну свободную
 * клетку по периметру — иначе игрок замуровал бы слоты и остался без урожая.
 */
export function canPlace(
  p: Placed,
  fp: Footprint,
  blocked: ReadonlySet<string>,
): boolean {
  if (!inYard(p, fp)) return false
  for (const c of placementCells(p, fp)) {
    if (blocked.has(cellKey(c.gx, c.gz))) return false
  }
  return ringCells(p, fp).some((c) => !blocked.has(cellKey(c.gx, c.gz)))
}
