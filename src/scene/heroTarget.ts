/**
 * Цель ходьбы героя в мировых координатах: пишет Ground по клику,
 * читает Hero в useFrame.
 *
 * Отдельный модуль, а не экспорт из Hero.tsx: экспорт не-компонента из
 * файла с компонентом ломает Fast Refresh (vite-plugin-react ругается и
 * перезагружает страницу целиком).
 */
import * as THREE from 'three'

export const heroTarget = new THREE.Vector3()

// Доступ из DevTools и автопроверок. В прод-сборку не попадает.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __heroTarget?: unknown }).__heroTarget = heroTarget
}
