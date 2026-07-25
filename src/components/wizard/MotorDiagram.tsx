import { C } from '../../theme/tokens'

/** 顶视电机布局图：编号 + 旋向（奇数 CW 红、偶数 CCW 绿，对应手册）。 */
export function MotorDiagram({
  count,
  active,
  size = 190
}: {
  count: number
  active?: number | null
  size?: number
}): JSX.Element {
  const cx = size / 2
  const cy = size / 2
  const R = size / 2 - 26
  const motors = Array.from({ length: count }, (_, i) => {
    const ang = (-90 + (i * 360) / count) * (Math.PI / 180)
    return { i, n: i + 1, x: cx + Math.cos(ang) * R, y: cy + Math.sin(ang) * R, cw: i % 2 === 0 }
  })
  return (
    <svg width={size} height={size} style={{ display: 'block', margin: '0 auto' }}>
      {/* 机臂 */}
      {motors.map((m) => (
        <line key={`a${m.i}`} x1={cx} y1={cy} x2={m.x} y2={m.y} stroke={C.stroke} strokeWidth={3} />
      ))}
      {/* 机头指示 */}
      <path d={`M${cx} ${cy - R - 6} l-6 12 l12 0 z`} fill={C.accent} />
      {/* 中心 */}
      <circle cx={cx} cy={cy} r={12} fill={C.bg2} stroke={C.stroke} />
      {/* 电机 */}
      {motors.map((m) => {
        const on = active === m.n
        const col = m.cw ? C.danger : C.success
        return (
          <g key={m.i}>
            <circle
              cx={m.x}
              cy={m.y}
              r={15}
              fill={on ? col : C.bg3}
              stroke={col}
              strokeWidth={2}
              style={on ? { filter: `drop-shadow(0 0 8px ${col})` } : undefined}
            />
            <text x={m.x} y={m.y + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill={on ? '#04121a' : C.textHi}>
              {m.n}
            </text>
            {/* 旋向弧 */}
            <path
              d={arcPath(m.x, m.y, 20, m.cw)}
              fill="none"
              stroke={col}
              strokeWidth={1.6}
              markerEnd=""
              opacity={0.8}
            />
          </g>
        )
      })}
    </svg>
  )
}

function arcPath(cx: number, cy: number, r: number, cw: boolean): string {
  const a0 = cw ? -40 : 220
  const a1 = cw ? 200 : -20
  const p0 = { x: cx + r * Math.cos((a0 * Math.PI) / 180), y: cy + r * Math.sin((a0 * Math.PI) / 180) }
  const p1 = { x: cx + r * Math.cos((a1 * Math.PI) / 180), y: cy + r * Math.sin((a1 * Math.PI) / 180) }
  return `M${p0.x.toFixed(1)} ${p0.y.toFixed(1)} A ${r} ${r} 0 1 ${cw ? 1 : 0} ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`
}
