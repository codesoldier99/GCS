import { useVehicleField } from '../../state/useVehicleField'

/** M1..M8 电机油门条 */
export function ThrottleBars(): JSX.Element {
  const motors = useVehicleField((f) => f.motors)
  const armed = useVehicleField((f) => f.armed)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px 12px' }}>
      {motors.slice(0, 8).map((v, i) => {
        const pct = Math.max(0, Math.min(100, v))
        const color =
          pct > 85 ? 'var(--danger)' : pct > 65 ? 'var(--accent)' : 'var(--primary)'
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--text-lo)', width: 18 }}>M{i + 1}</span>
            <div
              style={{
                flex: 1,
                height: 6,
                borderRadius: 3,
                background: 'rgba(255,255,255,0.06)',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: color,
                  boxShadow: armed ? `0 0 6px ${color}` : 'none',
                  transition: 'width .12s linear, background .2s'
                }}
              />
            </div>
            <span
              className="readout"
              style={{ fontSize: 10.5, width: 26, textAlign: 'right', color: 'var(--text-mid)' }}
            >
              {armed ? Math.round(pct) : '--'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
