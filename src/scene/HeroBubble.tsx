/**
 * Комиксовое облачко с репликой над героем.
 *
 * Как и SpeechBubble у растений: canvas на Billboard, а не drei/Html. Это часть
 * сцены — облачко перекрывается геометрией и уезжает вместе с камерой.
 *
 * Высота холста считается по числу строк: фразы разной длины, а растягивать
 * плоскость под самую длинную значило бы гонять пустое поле над головой.
 * Billboard разворачивает облачко к камере, поэтому поворот героя ему не важен.
 */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Billboard } from '@react-three/drei'

const W = 512 // ширина холста; высота зависит от числа строк
const PAD = 30 // отступ текста от рамки
const LINE = 46 // межстрочный интервал
const TAIL = 38 // высота хвостика
const BORDER = 9

const INK = '#241a20'
const PAPER = '#f0e4c9'
const FONT = '600 34px system-ui, -apple-system, "Segoe UI", sans-serif'

/** Ширина плоскости облачка в мировых единицах. */
const PLANE_W = 1.15
/** Макушка героя (0.85 × SCALE 1.5) плюс зазор — от неё растёт облачко. */
const HEAD_TOP = 1.275
const GAP = 0.1

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

/** Разбивает текст по словам так, чтобы каждая строка влезала в maxWidth. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

function drawBubble(text: string): { texture: THREE.CanvasTexture; height: number } {
  // Первый холст — только чтобы померить текст и узнать высоту итогового.
  const measure = document.createElement('canvas').getContext('2d')
  if (!measure) throw new Error('HeroSpeech: 2d-контекст недоступен')
  measure.font = FONT
  const maxWidth = W - 2 * (PAD + BORDER)
  const lines = wrap(measure, text, maxWidth)

  const bodyH = 2 * PAD + lines.length * LINE
  const H = bodyH + TAIL

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('HeroSpeech: 2d-контекст недоступен')

  ctx.fillStyle = PAPER
  ctx.strokeStyle = INK
  ctx.lineWidth = BORDER

  roundedRect(ctx, BORDER, BORDER, W - 2 * BORDER, bodyH - 2 * BORDER, 30)
  ctx.fill()
  ctx.stroke()

  // Хвостик — треугольник вниз, к голове героя.
  const cx = W / 2
  ctx.beginPath()
  ctx.moveTo(cx - 24, bodyH - 12)
  ctx.lineTo(cx - 2, H - 6)
  ctx.lineTo(cx + 20, bodyH - 12)
  ctx.closePath()
  ctx.fillStyle = PAPER
  ctx.fill()
  ctx.stroke()
  // Заклеиваем стык хвостика с телом, иначе виден шов обводки.
  ctx.beginPath()
  ctx.moveTo(cx - 20, bodyH - 13)
  ctx.lineTo(cx + 16, bodyH - 13)
  ctx.lineWidth = BORDER + 3
  ctx.strokeStyle = PAPER
  ctx.stroke()

  ctx.fillStyle = INK
  ctx.font = FONT
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  lines.forEach((line, i) => {
    ctx.fillText(line, cx, PAD + LINE * (i + 0.5))
  })

  const texture = new THREE.CanvasTexture(canvas)
  texture.anisotropy = 4
  texture.needsUpdate = true
  return { texture, height: H }
}

export function HeroBubble({ text }: { text: string }) {
  const { texture, height } = useMemo(() => drawBubble(text), [text])
  useEffect(() => () => texture.dispose(), [texture])

  const planeH = PLANE_W * (height / W)

  return (
    <Billboard position={[0, HEAD_TOP + GAP + planeH / 2, 0]}>
      <mesh>
        <planeGeometry args={[PLANE_W, planeH]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} />
      </mesh>
    </Billboard>
  )
}
