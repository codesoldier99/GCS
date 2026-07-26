import type { IconName } from '../Icon'
import { Icon } from '../Icon'
import { useVehicleField } from '../../state/useVehicleField'
import { n, clock, fixLabel } from '../../util/format'

function Stat({
  icon,
  label,
  value,
  unit,
  color,
  sub
}: {
  icon: IconName
  label: string
  value: string
  unit?: string
  color?: string
  sub?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 15px', minWidth: 0 }}>
      <Icon name={icon} size={22} style={{ color: color ?? 'var(--text-lo)', flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span className="readout" style={{ fontSize: 20, fontWeight: 700, color: color ?? 'var(--text-hi)' }}>
            {value}
          </span>
          {unit && <span style={{ fontSize: 12, color: 'var(--text-mid)' }}>{unit}</span>}
        </div>
        <span style={{ fontSize: 11.5, color: 'var(--text-mid)', whiteSpace: 'nowrap' }}>
          {sub ?? label}
        </span>
      </div>
    </div>
  )
}

const Sep = () => (
  <div style={{ width: 1, height: 36, background: 'var(--stroke-soft)', flexShrink: 0 }} />
)

export function TopStatusBar(): JSX.Element {
  const modeLabel = useVehicleField((f) => f.mode.label)
  const armed = useVehicleField((f) => f.armed)
  const voltage = useVehicleField((f) => f.voltage)
  const battery = useVehicleField((f) => f.batteryRemaining)
  const sats = useVehicleField((f) => f.satellites)
  const fix = useVehicleField((f) => f.gpsFix)
  const hs = useVehicleField((f) => f.groundSpeed)
  const vs = useVehicleField((f) => f.climb)
  const relAlt = useVehicleField((f) => f.relAlt)
  const amsl = useVehicleField((f) => f.amsl)
  const dist = useVehicleField((f) => f.distanceToHome)
  const ft = useVehicleField((f) => f.flightTime)

  const battColor = voltage > 0 && voltage < 21.5 ? 'var(--danger)' : battery < 25 ? 'var(--accent)' : 'var(--text-hi)'
  const gpsColor = fix === '3d' || fix.startsWith('rtk') ? 'var(--success)' : sats > 0 ? 'var(--accent)' : 'var(--danger)'

  return (
    <div
      style={{
        height: 'var(--bar-h)',
        display: 'flex',
        alignItems: 'center',
        background: 'linear-gradient(180deg, rgba(11,17,30,0.96), rgba(9,13,22,0.86))',
        borderBottom: '1px solid var(--stroke)',
        backdropFilter: 'blur(8px)'
      }}
    >
      <Stat icon="drone" label="模式" value={modeLabel} color="var(--primary)" />
      <Sep />
      <Stat
        icon="propeller"
        label="螺旋桨"
        value={armed ? '已解锁' : '已闭锁'}
        color={armed ? 'var(--success)' : 'var(--text-mid)'}
      />
      <Sep />
      <Stat icon="battery" label="电压" value={n(voltage, 1)} unit="V" color={battColor} sub={`电压 · ${n(battery, 0)}%`} />
      <Sep />
      <Stat icon="satellite" label="卫星" value={String(sats)} color={gpsColor} sub={`卫星 · ${fixLabel(fix)}`} />
      <Sep />
      <Stat icon="speed-h" label="水平速度" value={n(hs, 1)} unit="m/s" sub="水平速度 HS" />
      <Sep />
      <Stat icon="speed-v" label="垂直速度" value={n(vs, 1)} unit="m/s" sub="垂直速度 VS" />
      <Sep />
      <Stat icon="altitude" label="高度" value={n(relAlt, 1)} unit="m" sub="相对高度" />
      <Sep />
      <Stat icon="mountain" label="海拔" value={n(amsl, 1)} unit="m" sub="海拔" />
      <Sep />
      <Stat icon="flag" label="距离" value={n(dist, 1)} unit="m" sub="距起飞点" />
      <Sep />
      <Stat icon="clock" label="飞行时间" value={clock(ft)} sub="飞行时间" />
      <div style={{ flex: 1 }} />
    </div>
  )
}
