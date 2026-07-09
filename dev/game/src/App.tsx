import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Perf } from 'r3f-perf'

// Скаффолд стека (начало Task 1). Реальная <Farm /> из scene-layout.json
// придёт, когда экспортёр сгенерирует public/assets/. Пока — дымовой тест
// три/fiber/drei/r3f-perf: сцена собирается и рендерится.
export default function App() {
  return (
    <Canvas shadows camera={{ position: [6, 6, 10], fov: 45 }}>
      <Perf position="top-left" />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 15, 10]} intensity={1.5} castShadow />
      <mesh castShadow position={[0, 0.5, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial color="#9fc25f" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshLambertMaterial color="#5a8f33" />
      </mesh>
      <OrbitControls />
    </Canvas>
  )
}
