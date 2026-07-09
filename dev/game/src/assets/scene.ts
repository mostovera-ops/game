/**
 * Загрузка и типы данных сцены из public/assets/.
 * Только рендер-слой (scene/) импортирует это; game/ ничего отсюда не берёт.
 */
import * as THREE from 'three'

export type Vec3 = [number, number, number]

export interface PropInstance {
  asset: string
  position: Vec3
  rotationY: number
  scale: Vec3
}

export interface Plot {
  id: number
  bed: Vec3
  slots: Vec3[]
}

export interface SceneLayout {
  props: PropInstance[]
  plots: Plot[]
  ground: { size: number; material: string }
  camera: { position: Vec3; target: Vec3; isOrtho: boolean }
  sun: { direction: Vec3; color: string; energy: number }
}

export type Palette = Record<string, string>

// --- Suspense-загрузчик JSON (fetch + кэш) ---------------------------------

const cache = new Map<string, unknown>()
const pending = new Map<string, Promise<unknown>>()

export function useJSON<T>(url: string): T {
  if (cache.has(url)) return cache.get(url) as T
  let p = pending.get(url)
  if (!p) {
    p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`${url}: ${r.status}`)
        return r.json()
      })
      .then((data) => {
        cache.set(url, data)
        return data
      })
    pending.set(url, p)
  }
  throw p
}

// --- Материалы: плоские MeshLambert по палитре ------------------------------
// Цель — вид «Blender solid viewport»: без PBR, без текстур, flat shading.

const materials = new Map<string, THREE.MeshLambertMaterial>()

export function lambert(name: string, palette: Palette): THREE.MeshLambertMaterial {
  const cached = materials.get(name)
  if (cached) return cached
  const hex = palette[name] ?? '#cc44cc' // ярко-розовый = не найден в палитре
  const glass = name === 'GreenhouseGlass'
  const mat = new THREE.MeshLambertMaterial({
    color: new THREE.Color(hex),
    flatShading: true,
    transparent: glass,
    opacity: glass ? 0.35 : 1,
  })
  materials.set(name, mat)
  return mat
}

interface ShadowOpts {
  cast?: boolean
  receive?: boolean
}

/** Заменить материалы GLB-объекта на плоские из палитры и задать тени. */
export function applyPalette(
  root: THREE.Object3D,
  palette: Palette,
  opts: ShadowOpts = {},
): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = !!opts.cast
    mesh.receiveShadow = !!opts.receive
    const cur = mesh.material
    mesh.material = Array.isArray(cur)
      ? cur.map((m) => lambert((m as THREE.Material).name, palette))
      : lambert((cur as THREE.Material).name, palette)
  })
}

/** Плоские единичные меши GLB (по одному на материал), с запечённой мировой
 * матрицей — готовы для инстансинга. */
export function meshParts(
  root: THREE.Object3D,
  palette: Palette,
): { geometry: THREE.BufferGeometry; material: THREE.Material }[] {
  root.updateWorldMatrix(true, true)
  const parts: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = []
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const geometry = mesh.geometry.clone()
    geometry.applyMatrix4(mesh.matrixWorld)
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
    parts.push({ geometry, material: lambert((mat as THREE.Material).name, palette) })
  })
  return parts
}
