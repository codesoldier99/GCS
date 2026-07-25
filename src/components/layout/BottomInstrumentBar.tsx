import { useState } from 'react'
import { AttitudeBall } from '../instruments/AttitudeBall'
import { ThrottleBars } from '../instruments/ThrottleBars'
import { VibrationMeter } from '../instruments/VibrationMeter'
import { useVehicleField } from '../../state/useVehicleField'
import { n, signedDeg, deg } from '../../util/format'
import { Icon } from '../Icon'

function Col({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div className="label" style={{ color: 'var(--primary)' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({ k, v, unit, color }: { k: string; v: string; unit?: string; color?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 16,
        fontSize: 12,
        whiteSpace: 'nowrap'
      }}
    >
      <span style={{ color: 'var(--text-lo)' }}>{k}</span>
      <span className="readout" style={{ color: color ?? 'var(--text-hi)' }}>
        {v}
        {unit && <span style={{ color: 'var(--text-lo)', fontSize: 10, marginLeft: 2 }}>{unit}</span>}
      </span>
    </div>
  )
}

export function BottomInstrumentBar(): JSX.Element {
  const [open, setOpen] = useState(true)

  const vx = useVehicleField((f) => f.vx)
  const vy = useVehicleField((f) => f.vy)
  const vz = useVehicleField((f) => f.vz)
  const targetSpeed = useVehicleField((f) => f.targetSpeed)
  const roll = useVehicleField((f) => f.roll)
  const pitch = useVehicleField((f) => f.pitch)
  const yaw = useVehicleField((f) => f.yaw)
  const gpsYaw = useVehicleField((f) => f.gpsYaw)
  const relAlt = useVehicleField((f) => f.relAlt)
  const amsl = useVehicleField((f) => f.amsl)
  const targetAlt = useVehicleField((f) => f.targetAlt)
  const dist = useVehicleField((f) => f.distanceToHome)
  const altAbove = useVehicleField((f) => f.altAbove)

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="icon-btn"
          style={{
            pointerEvents: 'auto',
            width: 46,
            height: 22,
            borderRadius: '10px 10px 0 0',
            borderBottom: 'none',
            marginBottom: -1
          }}
        >
          <Icon name={open ? 'minus' : 'plus'} size={16} />
        </button>
      </div>

      {open && (
        <div
          style={{
            pointerEvents: 'auto',
            display: 'grid',
            gridTemplateColumns: 'minmax(190px,1.1fr) 128px 138px auto 128px 138px 150px',
            gap: 26,
            alignItems: 'center',
            padding: '14px 26px',
            background: 'linear-gradient(180deg, rgba(10,15,26,0.82), rgba(8,11,18,0.94))',
            borderTop: '1px solid var(--stroke)',
            backdropFilter: 'blur(10px)'
          }}
        >
          <Col title="电机油门">
            <ThrottleBars />
          </Col>

          <Col title="速度">
            <Row k="目标" v={n(targetSpeed, 1)} unit="m/s" />
            <Row k="北向" v={n(vx, 1)} unit="m/s" />
            <Row k="东向" v={n(vy, 1)} unit="m/s" />
            <Row k="垂直" v={n(vz, 1)} unit="m/s" />
          </Col>

          <Col title="姿态">
            <Row k="横滚" v={signedDeg(roll)} unit="°" />
            <Row k="俯仰" v={signedDeg(pitch)} unit="°" />
            <Row k="航向" v={deg(yaw)} unit="°" />
            <Row k="GPS航向" v={deg(gpsYaw)} unit="°" />
          </Col>

          <div style={{ display: 'grid', placeItems: 'center', padding: '0 6px' }}>
            <AttitudeBall size={168} />
          </div>

          <Col title="高度">
            <Row k="目标" v={n(targetAlt, 1)} unit="m" />
            <Row k="高度" v={n(relAlt, 1)} unit="m" />
            <Row k="海拔" v={n(amsl, 1)} unit="m" />
          </Col>

          <Col title="距离">
            <Row k="距起飞点" v={n(dist, 1)} unit="m" />
            <Row k="对地" v={n(altAbove, 1)} unit="m" />
            <Row k="向前" v={n(0, 1)} unit="m" />
          </Col>

          <Col title="振动指数">
            <VibrationMeter />
          </Col>
        </div>
      )}
    </div>
  )
}
