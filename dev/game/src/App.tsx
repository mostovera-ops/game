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

const SHOW_PERF =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('perf')

export default function App() {
  return (
    <div className="relative h-full w-full">
      <Canvas flat shadows dpr={[1, 2]}>
        <color attach="background" args={['#cfe1ee']} />
        <OrthographicCamera makeDefault position={[10, 8, 13]} zoom={46} near={0.1} far={200} />
        {SHOW_PERF && <Perf position="top-left" />}
        <Suspense fallback={null}>
          <Farm />
          <RenderStats />
        </Suspense>
        <OrbitControls makeDefault target={[1.5, 0.4, -0.5]} />
      </Canvas>
      <HUD />
    </div>
  )
}
