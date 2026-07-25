import { useVehicleField } from '../../state/useVehicleField'

const AXES = ['X', 'Y', 'Z'] as const

/** 振动指数 X/Y/Z（<30 正常, 30-60 注意, >60 危险）。 */
export function VibrationMeter(): JSX.Element {
  const vib = useVehicleField((f) => f.vibration)
  const vals = [vib.x, vib.y, vib.z]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {AXES.map((ax, i) => {
        const v = vals[i]
        const pct = Math.min(100, (v / 90) * 100)
        const color = v > 60 ? 'var(--danger)' : v > 30 ? 'var(--accent)' : 'var(--success)'
        return (
          <div key={ax} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10.5, color: 'var(--text-lo)', width: 26 }}>{ax}轴</span>
            <div
              style={{
                flex: 1,
                height: 5,
                borderRadius: 3,
                background: 'rgba(255,255,255,0.06)',
                overflow: 'hidden'
              }}
            >
              <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width .2s' }} />
            </div>
            <span className="readout" style={{ fontSize: 11, width: 30, textAlign: 'right', color }}>
              {v.toFixed(0)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
