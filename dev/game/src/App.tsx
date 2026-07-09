import { Suspense } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, OrthographicCamera } from '@react-three/drei'
import { Perf } from 'r3f-perf'
import { Farm } from './scene/Farm'
import { HUD } from './ui/HUD'

// Пишет число draw call'ов в window — чтобы снять метрику из скриншот-харнеса.
function RenderStats() {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  useFrame(() => {
    const w = window as unknown as { __render?: unknown; __r3f?: unknown }
    w.__render = { calls: gl.info.render.calls, triangles: gl.info.render.triangles }
    // проекция мировой точки → пиксель канваса (для клик-теста в харнесе)
    w.__r3f = {
      project: (x: number, y: number, z: number) => {
        const v = new THREE.Vector3(x, y, z).project(camera)
        return { x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height }
      },
    }
  })
  return null
}

const params =
  typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
const SHOW_PERF = params.has('perf')

// Дефолтный кадр фермы (подобран под референс). Переопределяется из URL:
//   ?cam=x,y,z&tgt=x,y,z&zoom=N — чтобы искать ракурс без пересборки.
const num3 = (v: string | null, fallback: [number, number, number]): [number, number, number] => {
  const p = v?.split(',').map(Number)
  return p && p.length === 3 && p.every((n) => !Number.isNaN(n)) ? [p[0], p[1], p[2]] : fallback
}
const CAM_POS = num3(params.get('cam'), [8, 13, 7])
const CAM_TARGET = num3(params.get('tgt'), [4, 0.3, -0.6])
const CAM_ZOOM = params.get('zoom') ? Number(params.get('zoom')) : 100

export default function App() {
  return (
    <div className="relative h-full w-full">
      <Canvas flat shadows dpr={[1, 2]}>
        <color attach="background" args={['#cfe1ee']} />
        <OrthographicCamera makeDefault position={CAM_POS} zoom={CAM_ZOOM} near={0.1} far={200} />
        {SHOW_PERF && <Perf position="top-left" />}
        <Suspense fallback={null}>
          <Farm />
          <RenderStats />
        </Suspense>
        <OrbitControls makeDefault target={CAM_TARGET} />
      </Canvas>
      <HUD />
    </div>
  )
}
