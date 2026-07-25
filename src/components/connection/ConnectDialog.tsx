import { useEffect, useState } from 'react'
import { useUi } from '../../state/uiStore'
import { useLink } from '../../state/linkStore'
import type { ConnectOptions, SerialPortInfo } from '@shared/protocol'
import { Icon } from '../Icon'

type Tab = 'sim' | 'serial' | 'udp' | 'tcp'

export function ConnectDialog(): JSX.Element | null {
  const open = useUi((s) => s.connectOpen)
  const close = useUi((s) => s.closeConnect)
  const connect = useLink((s) => s.connect)
  const disconnect = useLink((s) => s.disconnect)
  const status = useLink((s) => s.status)

  const [tab, setTab] = useState<Tab>('sim')
  const [ports, setPorts] = useState<SerialPortInfo[]>([])
  const [serialPath, setSerialPath] = useState('')
  const [baud, setBaud] = useState(115200)
  const [udpPort, setUdpPort] = useState(14550)
  const [tcpHost, setTcpHost] = useState('127.0.0.1')
  const [tcpPort, setTcpPort] = useState(5760)

  useEffect(() => {
    if (open && tab === 'serial') {
      window.gcs.listSerialPorts().then((p) => {
        setPorts(p)
        if (p[0] && !serialPath) setSerialPath(p[0].path)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab])

  if (!open) return null

  const doConnect = async () => {
    let opts: ConnectOptions
    if (tab === 'sim') opts = { kind: 'sim' }
    else if (tab === 'serial') opts = { kind: 'serial', path: serialPath, baudRate: baud }
    else if (tab === 'udp') opts = { kind: 'udp', localPort: udpPort }
    else opts = { kind: 'tcp', host: tcpHost, port: tcpPort }
    await connect(opts)
    close()
  }

  const connected = status.state === 'connected'

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(4,7,13,0.62)',
        backdropFilter: 'blur(3px)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 100
      }}
    >
      <div
        className="panel"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 460, padding: 0, overflow: 'hidden' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '14px 18px',
            borderBottom: '1px solid var(--stroke)'
          }}
        >
          <Icon name="link" size={18} style={{ color: 'var(--primary)', marginRight: 8 }} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>连接设置</span>
          <div style={{ flex: 1 }} />
          <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={close}>
            <Icon name="close" size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, padding: '14px 18px 0' }}>
          {(['sim', 'serial', 'udp', 'tcp'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="btn"
              style={{
                flex: 1,
                padding: '8px 0',
                background: tab === t ? 'var(--primary-dim)' : 'var(--bg-2)',
                borderColor: tab === t ? 'var(--primary)' : 'var(--stroke)',
                color: tab === t ? 'var(--primary)' : 'var(--text-mid)'
              }}
            >
              {{ sim: '仿真', serial: '串口', udp: 'UDP', tcp: 'TCP' }[t]}
            </button>
          ))}
        </div>

        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 150 }}>
          {tab === 'sim' && (
            <div style={{ color: 'var(--text-mid)', fontSize: 13.5, lineHeight: 1.7 }}>
              <b style={{ color: 'var(--text-hi)' }}>内置飞行仿真</b>
              <br />
              无需硬件即可练习全部界面与操作。连接后可在飞行界面点击「一键演示」，无人机将自动起飞并绕圈飞行，遥测/姿态球/地图轨迹全部实时联动。
            </div>
          )}

          {tab === 'serial' && (
            <>
              <Field label="串口">
                <select
                  className="fld"
                  value={serialPath}
                  onChange={(e) => setSerialPath(e.target.value)}
                >
                  {ports.length === 0 && <option value="">未检测到串口</option>}
                  {ports.map((p) => (
                    <option key={p.path} value={p.path}>
                      {p.path}
                      {p.manufacturer ? ` · ${p.manufacturer}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="波特率">
                <select className="fld" value={baud} onChange={(e) => setBaud(+e.target.value)}>
                  {[57600, 115200, 921600].map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}

          {tab === 'udp' && (
            <Field label="本地监听端口">
              <input
                className="fld"
                type="number"
                value={udpPort}
                onChange={(e) => setUdpPort(+e.target.value)}
              />
              <div className="hint">ArduPilot SITL 默认发送到 127.0.0.1:14550</div>
            </Field>
          )}

          {tab === 'tcp' && (
            <>
              <Field label="主机">
                <input className="fld" value={tcpHost} onChange={(e) => setTcpHost(e.target.value)} />
              </Field>
              <Field label="端口">
                <input
                  className="fld"
                  type="number"
                  value={tcpPort}
                  onChange={(e) => setTcpPort(+e.target.value)}
                />
              </Field>
            </>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 10,
            padding: '0 18px 18px',
            justifyContent: 'flex-end'
          }}
        >
          {connected && (
            <button className="btn danger" onClick={() => disconnect().then(close)}>
              <Icon name="unlink" size={16} /> 断开
            </button>
          )}
          <button className="btn primary" onClick={doConnect}>
            <Icon name="play" size={16} /> 连接
          </button>
        </div>
      </div>

      <style>{`
        .fld{width:100%;padding:9px 11px;border-radius:var(--r-sm);border:1px solid var(--stroke);
          background:var(--bg-0);color:var(--text-hi);font-size:14px;font-family:var(--font-ui);outline:none}
        .fld:focus{border-color:var(--primary);box-shadow:0 0 0 1px var(--primary-dim)}
        .hint{font-size:11.5px;color:var(--text-lo);margin-top:6px}
      `}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div className="label" style={{ marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </label>
  )
}
