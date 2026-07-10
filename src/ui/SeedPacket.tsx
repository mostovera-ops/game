/**
 * Пакетик семян: бумажный конверт с зубчатым верхом и рисованным саженцем.
 * Иллюстрация у каждой культуры своя — по ней пакетик и узнают, поэтому
 * росток рисуем, а не подставляем эмодзи готового плода.
 */
import type { CropId } from '../game/store'

interface Look {
  /** Фон конверта и цвет «окошка» с рисунком. */
  paper: string
  window: string
  leaf: string
  /** Что торчит из земли: корень моркови, кочан зелени, плод томата. */
  accent: string
}

const LOOK: Record<CropId, Look> = {
  carrot: { paper: '#e8a54f', window: '#fbe6c2', leaf: '#6b8f3f', accent: '#e2701f' },
  greens: { paper: '#8fbf5a', window: '#e9f3d5', leaf: '#4f7a33', accent: '#7cc476' },
  tomato: { paper: '#d1584a', window: '#fbdcd4', leaf: '#5f8a3c', accent: '#d1453a' },
}

/** Рисунок саженца: земля, стебель, два листа, намёк на будущий плод. */
function Sprout({ crop, look }: { crop: CropId; look: Look }) {
  return (
    <g>
      {/* холмик земли */}
      <path d="M4 27 Q12 22 20 27 L20 29 L4 29 Z" fill="#6b4f34" />
      {/* стебель */}
      <path d="M12 27 L12 13" stroke={look.leaf} strokeWidth="1.6" strokeLinecap="round" />
      {/* листья */}
      <path d="M12 18 Q6 16 5.5 10 Q11 11 12 18 Z" fill={look.leaf} />
      <path d="M12 20 Q18 18 18.5 12 Q13 13 12 20 Z" fill={look.leaf} opacity="0.85" />

      {crop === 'carrot' && (
        // морковь прячется в земле — виден только плечик корня
        <path d="M10.4 27 L13.6 27 L12 31 Z" fill={look.accent} />
      )}
      {crop === 'tomato' && <circle cx="15.6" cy="21.6" r="2.5" fill={look.accent} />}
      {crop === 'greens' && (
        <path d="M12 22 Q7.5 21 7 16.5 Q11.5 17.5 12 22 Z" fill={look.accent} opacity="0.9" />
      )}
    </g>
  )
}

export function SeedPacket({ crop, active }: { crop: CropId; active: boolean }) {
  const look = LOOK[crop]
  return (
    <svg viewBox="0 0 24 34" className="h-9 w-[26px]" aria-hidden>
      {/* конверт */}
      <path
        d="M1 4 h22 v28 a1.5 1.5 0 0 1 -1.5 1.5 h-19 A1.5 1.5 0 0 1 1 32 Z"
        fill={look.paper}
        stroke={active ? '#241a20' : '#241a20'}
        strokeOpacity={active ? 0.9 : 0.35}
        strokeWidth="1"
      />
      {/* зубчатый отрыв сверху */}
      <path
        d="M1 4 l2.6 -2.4 l2.6 2.4 l2.6 -2.4 l2.6 2.4 l2.6 -2.4 l2.6 2.4 l2.6 -2.4 l2.6 2.4 Z"
        fill={look.paper}
        stroke="#241a20"
        strokeOpacity={active ? 0.9 : 0.35}
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      {/* окошко с рисунком */}
      <rect x="3" y="8" width="18" height="22" rx="2" fill={look.window} />
      <Sprout crop={crop} look={look} />
    </svg>
  )
}
