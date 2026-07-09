import { Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, OrthographicCamera } from '@react-three/drei'
import { Perf } from 'r3f-perf'
import { Farm } from './scene/Farm'

// Пишет число draw call'ов в window — чтобы снять метрику из скриншот-харнеса.
function RenderStats() {
  const gl = useThree((s) => s.gl)
  useFrame(() => {
    ;(window as unknown as { __render?: unknown }).__render = {
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
    }
  })
  return null
}

export default function App() {
  return (
    <Canvas flat shadows dpr={[1, 2]}>
      <color attach="background" args={['#cfe1ee']} />
      <OrthographicCamera makeDefault position={[9, 6, 12]} zoom={42} near={0.1} far={200} />
      <Perf position="top-left" />
      <Suspense fallback={null}>
        <Farm />
        <RenderStats />
      </Suspense>
      <OrbitControls makeDefault target={[-1, 0.5, 0]} />
    </Canvas>
  )
}
