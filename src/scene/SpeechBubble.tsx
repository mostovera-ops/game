/**
 * Комиксовое облачко над созревшим растением: «я готов, во мне вот это».
 *
 * Рисуется в canvas и вешается на Billboard — плоскость всегда развёрнута
 * к камере. drei/Html здесь не годится: HUD живёт в DOM, а это часть сцены
 * и должно перекрываться геометрией и уезжать вместе с камерой.
 *
 * У удачного растения (даст 2 единицы) рамка золотая и подписано «×2».
 */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Billboard } from '@react-three/drei'
import type { CropId } from '../game/store'

const CROP_GLYPH: Record<CropId, string> = { carrot: '🥕', greens: '🥬', tomato: '🍅' }

const W = 256
const H = 208
const TAIL = 40 // высота хвостика облачка

const INK = '#241a20'
const PAPER = '#f0e4c9'
const GOLD = '#f4b942'

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawBubble(crop: CropId, lucky: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('SpeechBubble: 2d-контекст недоступен')

  const bodyH = H - TAIL
  const border = lucky ? GOLD : INK

  ctx.fillStyle = PAPER
  ctx.strokeStyle = border
  ctx.lineWidth = lucky ? 12 : 9

  roundedRect(ctx, 10, 10, W - 20, bodyH - 20, 34)
  ctx.fill()
  ctx.stroke()

  // Хвостик — треугольник вниз, обводится отдельно, чтобы шов не был виден.
  const cx = W / 2
  ctx.beginPath()
  ctx.moveTo(cx - 26, bodyH - 14)
  ctx.lineTo(cx, H - 8)
  ctx.lineTo(cx + 22, bodyH - 14)
  ctx.closePath()
  ctx.fillStyle = PAPER
  ctx.fill()
  ctx.strokeStyle = border
  ctx.stroke()
  // Заклеиваем стык хвостика с телом облачка.
  ctx.beginPath()
  ctx.moveTo(cx - 22, bodyH - 15)
  ctx.lineTo(cx + 18, bodyH - 15)
  ctx.lineWidth = 12
  ctx.strokeStyle = PAPER
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `${lucky ? 88 : 104}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`
  ctx.fillText(CROP_GLYPH[crop], cx, bodyH / 2 - (lucky ? 16 : 4))

  if (lucky) {
    ctx.font = 'bold 46px ui-monospace, Menlo, monospace'
    ctx.fillStyle = '#b07d16'
    ctx.fillText('×2', cx, bodyH - 44)
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}

export function SpeechBubble({
  crop,
  lucky,
  y = 0.78,
}: {
  crop: CropId
  lucky: boolean
  y?: number
}) {
  const texture = useMemo(() => drawBubble(crop, lucky), [crop, lucky])
  useEffect(() => () => texture.dispose(), [texture])

  return (
    <Billboard position={[0, y, 0]}>
      <mesh>
        <planeGeometry args={[0.42, 0.42 * (H / W)]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} />
      </mesh>
    </Billboard>
  )
}
