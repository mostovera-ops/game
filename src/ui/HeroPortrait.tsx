/**
 * Портрет героя — SVG, а не второй three-канвас: рисовать ту же модель ещё
 * раз ради статичной картинки в панели незачем. Формы повторяют hero.glb
 * (капсула-голова, конус-туловище, ноги-палки, выпуклые глаза), поэтому
 * выбранный цвет читается так же, как потом на сцене.
 *
 * Затенение — чёрная плашка с opacity поверх той же заливки: так один цвет
 * даёт и свет, и тень, без второй палитры.
 */
export function HeroPortrait({ color, className }: { color: string; className?: string }) {
  return (
    <svg viewBox="0 0 120 160" className={className} aria-hidden>
      <ellipse cx="60" cy="151" rx="32" ry="5" fill="#000" opacity="0.2" />

      {/* Ноги со ступнями. */}
      {[-1, 1].map((s) => (
        <g key={s} fill={color}>
          <rect x={s < 0 ? 47 : 65} y="98" width="8" height="44" />
          <rect x={s < 0 ? 43 : 61} y="138" width="16" height="8" rx="4" />
        </g>
      ))}
      <rect x="43" y="138" width="16" height="8" rx="4" fill="#000" opacity="0.15" />
      <rect x="61" y="138" width="16" height="8" rx="4" fill="#000" opacity="0.15" />

      {/* Конус-туловище: узкие плечи, широкий подол. */}
      <path d="M52 56 H68 L96 114 Q60 122 24 114 Z" fill={color} />
      <path d="M68 56 L96 114 Q78 118 60 119 L60 56 Z" fill="#000" opacity="0.12" />

      {/* Капсула-голова. */}
      <rect x="43" y="12" width="34" height="52" rx="17" fill={color} />
      <rect x="60" y="12" width="17" height="52" rx="17" fill="#000" opacity="0.1" />

      {/* Глаза: белок с обводкой, зрачок смещён внутрь — как в модели. */}
      {[
        { cx: 52, px: 54.5 },
        { cx: 68, px: 65.5 },
      ].map((e) => (
        <g key={e.cx}>
          <circle cx={e.cx} cy="38" r="9" fill="#f7f7f5" stroke="#0d0d12" strokeWidth="1.5" />
          <circle cx={e.px} cy="40" r="3.8" fill="#0d0d12" />
        </g>
      ))}
    </svg>
  )
}
