/**
 * Облачко заказа над клиентом: что он хочет и сколько ещё подождёт.
 *
 * Эмодзи блюда рисуется в canvas один раз на рецепт (три текстуры на всю игру),
 * а полоса терпения — отдельный меш: она меняется каждый кадр, и перерисовывать
 * ради неё холст было бы расточительно.
 */
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { type RecipeId } from '../game/store'

const RECIPE_GLYPH: Record<RecipeId, string> = { salad: '🥗', soup: '🍲', taco: '🌮' }

const W = 192
const H = 168
const TAIL = 34

const INK = '#241a20'
const PAPER = '#f0e4c9'

const BAR_W = 0.3
const BAR_H = 0.035

/** Полоса терпения зеленеет в начале и краснеет к концу — как в старом HUD. */
const CALM = new THREE.Color('#9fc25f')
const PANIC = new THREE.Color('#d1453a')

const cache = new Map<RecipeId, THREE.CanvasTexture>()

function bubbleTexture(recipe: RecipeId): THREE.CanvasTexture {
  const hit = cache.get(recipe)
  if (hit) return hit

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('OrderBubble: 2d-контекст недоступен')

  const bodyH = H - TAIL
  const r = 28
  ctx.beginPath()
  ctx.moveTo(8 + r, 8)
  ctx.arcTo(W - 8, 8, W - 8, bodyH - 8, r)
  ctx.arcTo(W - 8, bodyH - 8, 8, bodyH - 8, r)
  ctx.arcTo(8, bodyH - 8, 8, 8, r)
  ctx.arcTo(8, 8, W - 8, 8, r)
  ctx.closePath()
  ctx.fillStyle = PAPER
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 8
  ctx.stroke()

  const cx = W / 2
  ctx.beginPath()
  ctx.moveTo(cx - 20, bodyH - 12)
  ctx.lineTo(cx, H - 6)
  ctx.lineTo(cx + 16, bodyH - 12)
  ctx.closePath()
  ctx.fillStyle = PAPER
  ctx.fill()
  ctx.stroke()
  // Заклеиваем шов хвостика с телом.
  ctx.beginPath()
  ctx.moveTo(cx - 16, bodyH - 13)
  ctx.lineTo(cx + 12, bodyH - 13)
  ctx.lineWidth = 10
  ctx.strokeStyle = PAPER
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '84px "Apple Color Emoji", "Segoe UI Emoji", sans-serif'
  ctx.fillText(RECIPE_GLYPH[recipe], cx, bodyH / 2 - 2)

  const tex = new THREE.CanvasTexture(canvas)
  tex.anisotropy = 4
  cache.set(recipe, tex)
  return tex
}

export function OrderBubble({
  recipe,
  patience,
  // Выше макушки: на 0.72 облачко пряталось внутри фигуры.
  y = 1.35,
}: {
  recipe: RecipeId
  /** Доля оставшегося терпения, 0..1. */
  patience: number
  y?: number
}) {
  const texture = useMemo(() => bubbleTexture(recipe), [recipe])
  const fill = useRef<THREE.Mesh>(null)
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  const pct = useRef(patience)
  pct.current = THREE.MathUtils.clamp(patience, 0, 1)

  useFrame(() => {
    const m = fill.current
    if (!m) return
    m.scale.x = Math.max(0.001, pct.current)
    // Полоса убывает справа налево, а не из центра.
    m.position.x = -(BAR_W * (1 - pct.current)) / 2
    mat.current?.color.copy(PANIC).lerp(CALM, THREE.MathUtils.smoothstep(pct.current, 0.2, 0.6))
  })

  return (
    <Billboard position={[0, y, 0]}>
      <mesh>
        <planeGeometry args={[0.34, 0.34 * (H / W)]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} />
      </mesh>

      {/* дорожка терпения под облачком */}
      <mesh position={[0, 0.19, 0.001]}>
        <planeGeometry args={[BAR_W, BAR_H]} />
        <meshBasicMaterial color="#241a20" transparent opacity={0.75} depthWrite={false} />
      </mesh>
      <mesh ref={fill} position={[0, 0.19, 0.002]}>
        <planeGeometry args={[BAR_W, BAR_H * 0.7]} />
        <meshBasicMaterial ref={mat} color="#9fc25f" depthWrite={false} />
      </mesh>
    </Billboard>
  )
}
