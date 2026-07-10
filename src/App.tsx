import { Suspense, useEffect, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, OrthographicCamera } from '@react-three/drei'
import { Perf } from 'r3f-perf'
import { Farm } from './scene/Farm'
import { HUD } from './ui/HUD'

interface CamState {
  pos: [number, number, number]
  target: [number, number, number]
  zoom: number
}

function RenderStats() {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  useFrame(() => {
    const w = window as unknown as { __render?: unknown; __r3f?: unknown }
    w.__render = { calls: gl.info.render.calls, triangles: gl.info.render.triangles }
    w.__r3f = {
      project: (x: number, y: number, z: number) => {
        const v = new THREE.Vector3(x, y, z).project(camera)
        return { x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height }
      },
    }
  })
  return null
}

// Пишет текущее состояние камеры в window — читает FramePanel.
function CameraProbe() {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera
  const controls = useThree((s) => s.controls) as { target?: THREE.Vector3 } | null
  useFrame(() => {
    const t = controls?.target
    const w = window as unknown as { __camState?: CamState }
    w.__camState = {
      pos: [camera.position.x, camera.position.y, camera.position.z],
      target: t ? [t.x, t.y, t.z] : [0, 0, 0],
      zoom: camera.zoom,
    }
  })
  return null
}

// Панель кадрирования (?frame): показывает параметры камеры и даёт их скопировать.
function FramePanel({ scene }: { scene: 'farm' | 'truck' }) {
  const [state, setState] = useState<CamState | null>(null)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const w = window as unknown as { __camState?: CamState }
      if (w.__camState) setState(w.__camState)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  if (!state) return null
  const f = (n: number) => n.toFixed(2)
  const url = `?cam=${state.pos.map(f).join(',')}&tgt=${state.target.map(f).join(',')}&zoom=${Math.round(
    state.zoom,
  )}`
  const other = scene === 'farm' ? '?frame=truck' : '?frame'
  return (
    <div className="pointer-events-auto absolute left-1/2 top-4 -translate-x-1/2 rounded-lg bg-black/80 px-4 py-3 text-center font-mono text-xs text-white">
      <div className="text-sm font-bold text-[#f4b942]">
        Кадрирую: {scene === 'farm' ? '🌱 ферма (дни 1–6)' : '🚚 фудтрек (день 7)'}
      </div>
      <div className="mt-1 opacity-80">перетаскивай — поворот · колесо — зум · правой кнопкой — сдвиг</div>
      <div className="mt-2 text-sm">
        cam=[{state.pos.map(f).join(', ')}] · tgt=[{state.target.map(f).join(', ')}] · zoom=
        {Math.round(state.zoom)}
      </div>
      <button
        onClick={() => void navigator.clipboard?.writeText(url)}
        className="mt-2 rounded bg-[#f4b942] px-3 py-1 font-bold text-black transition hover:brightness-110"
      >
        Копировать параметры камеры
      </button>
      <div className="mt-2 opacity-70">вторая сцена — открой {other}</div>
    </div>
  )
}

const params =
  typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
const SHOW_PERF = params.has('perf')
// ?frame — кадрируем ферму, ?frame=truck — кадрируем фудтрек, иначе игра.
const FRAME_SCENE: 'farm' | 'truck' | null = params.has('frame')
  ? params.get('frame') === 'truck'
    ? 'truck'
    : 'farm'
  : null

const num3 = (v: string | null, fallback: [number, number, number]): [number, number, number] => {
  const p = v?.split(',').map(Number)
  return p && p.length === 3 && p.every((n) => !Number.isNaN(n)) ? [p[0], p[1], p[2]] : fallback
}

// Две сцены — два ракурса. ?cam/tgt/zoom переопределяют текущий кадрируемый.
const FARM_CAM = {
  pos: num3(params.get('cam'), [10.67, 6.67, 12.41]),
  target: num3(params.get('tgt'), [2.17, 0.27, -0.39]),
  zoom: params.get('zoom') ? Number(params.get('zoom')) : 148,
}
// День 7 идёт крупным планом: в кадре только окно фудтрака и очередь у него.
// Камера ортографическая, поэтому «ближе» — это zoom, а не короче вектор.
const TRUCK_CAM = {
  pos: num3(FRAME_SCENE === 'truck' ? params.get('cam') : null, [6.0, 3.8, 1.4]),
  target: num3(FRAME_SCENE === 'truck' ? params.get('tgt') : null, [1.9, 0.75, -3.9]),
  zoom: FRAME_SCENE === 'truck' && params.get('zoom') ? Number(params.get('zoom')) : 155,
}

// Начальный кадр: в режиме кадрирования — под выбранную сцену; иначе ферма.
const START = FRAME_SCENE === 'truck' ? TRUCK_CAM : FARM_CAM

export default function App() {
  return (
    <div className="relative h-full w-full">
      <Canvas flat shadows dpr={[1, 2]}>
        <color attach="background" args={['#cfe1ee']} />
        <OrthographicCamera makeDefault position={START.pos} zoom={START.zoom} near={0.1} far={200} />
        {SHOW_PERF && <Perf position="top-left" />}
        <Suspense fallback={null}>
          <Farm farmCam={FARM_CAM} truckCam={TRUCK_CAM} rig={FRAME_SCENE === null} />
          <RenderStats />
        </Suspense>
        <OrbitControls makeDefault target={START.target} minZoom={20} maxZoom={300} />
        {FRAME_SCENE && <CameraProbe />}
      </Canvas>
      {!FRAME_SCENE && <HUD />}
      {FRAME_SCENE && <FramePanel scene={FRAME_SCENE} />}
    </div>
  )
}
