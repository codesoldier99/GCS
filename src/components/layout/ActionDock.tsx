import { useState } from 'react'
import { Icon, type IconName } from '../Icon'
import { useVehicleField } from '../../state/useVehicleField'
import { useLink } from '../../state/linkStore'
import { SELECTABLE_MODES, modeById } from '@shared/modeMap'
import { playCue } from '../../audio/engine'
import type { VehicleCommand } from '@shared/protocol'

async function confirmCmd(text: string, cmd: VehicleCommand): Promise<void> {
  // 危险指令（解锁/起飞/降落/返航）先给一记低频提示音，确认弹窗之外的第二重"注意"信号
  playCue('danger')
  if (window.confirm(text)) {
    await window.gcs.command(cmd)
    playCue('success')
  }
}

function DockBtn({
  icon,
  label,
  onClick,
  tone = 'default',
  disabled
}: {
  icon: IconName
  label: string
  onClick: () => void
  tone?: 'default' | 'primary' | 'danger' | 'success'
  disabled?: boolean
}) {
  const border =
    tone === 'danger' ? 'var(--danger)' : tone === 'success' ? 'var(--success)' : tone === 'primary' ? 'var(--primary)' : 'var(--stroke)'
  return (
    <button
      className="btn"
      onClick={onClick}
      disabled={disabled}
      style={{
        flexDirection: 'column',
        gap: 4,
        width: 66,
        height: 58,
        borderColor: border,
        color: tone === 'default' ? 'var(--text-mid)' : border,
        background: 'rgba(10,16,28,0.72)',
        fontSize: 11.5
      }}
    >
      <Icon name={icon} size={20} />
      {label}
    </button>
  )
}

export function ActionDock({ left = 14 }: { left?: number }): JSX.Element {
  const armed = useVehicleField((f) => f.armed)
  const source = useVehicleField((f) => f.source)
  const modeLabel = useVehicleField((f) => f.mode.label)
  const connected = useLink((s) => s.status.state === 'connected')
  const [modeOpen, setModeOpen] = useState(false)
  const [flying, setFlying] = useState(false)

  const isSim = source === 'sim'

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        zIndex: 5
      }}
    >
      <div className="panel" style={{ display: 'flex', gap: 8, padding: 10 }}>
        <DockBtn
          icon={armed ? 'unlink' : 'link'}
          label={armed ? '上锁' : '解锁'}
          tone={armed ? 'danger' : 'success'}
          disabled={!connected}
          onClick={() =>
            confirmCmd(
              armed ? '确认上锁（电机停转）？' : '确认解锁？请确保周围安全、已卸下螺旋桨或场地空旷。',
              { type: 'arm', arm: !armed }
            )
          }
        />
        <DockBtn
          icon="takeoff"
          label="起飞"
          tone="primary"
          disabled={!connected}
          onClick={() => confirmCmd('确认起飞到 30 米？', { type: 'takeoff', alt: 30 })}
        />
        <DockBtn
          icon="rtl"
          label="返航"
          disabled={!connected}
          onClick={() => confirmCmd('确认一键返航（RTL）？', { type: 'rtl' })}
        />
        <DockBtn
          icon="stop"
          label="降落"
          disabled={!connected}
          onClick={() => confirmCmd('确认原地降落？', { type: 'land' })}
        />
        <div style={{ position: 'relative' }}>
          <DockBtn
            icon="tuning"
            label={modeLabel}
            disabled={!connected}
            onClick={() => setModeOpen((o) => !o)}
          />
          {modeOpen && (
            <div
              className="panel"
              style={{
                position: 'absolute',
                top: 64,
                left: 0,
                padding: 6,
                width: 120,
                zIndex: 10
              }}
            >
              {SELECTABLE_MODES.map((id) => (
                <button
                  key={id}
                  className="btn ghost"
                  style={{ width: '100%', justifyContent: 'flex-start', padding: '7px 10px', fontSize: 13 }}
                  onClick={() => {
                    window.gcs.command({ type: 'setMode', modeId: id })
                    setModeOpen(false)
                  }}
                >
                  {modeById(id).label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {isSim && (
        <button
          className="btn"
          style={{
            alignSelf: 'flex-start',
            borderColor: flying ? 'var(--danger)' : 'var(--accent)',
            color: flying ? 'var(--danger)' : 'var(--accent)',
            background: 'rgba(10,16,28,0.72)'
          }}
          disabled={!connected}
          onClick={() => {
            const next = !flying
            setFlying(next)
            window.gcs.command({ type: 'simFly', enable: next })
          }}
        >
          <Icon name={flying ? 'stop' : 'play'} size={16} />
          {flying ? '结束演示（返航）' : '一键演示：自动起飞绕圈'}
        </button>
      )}
    </div>
  )
}
