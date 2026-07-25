import type { CSSProperties } from 'react'
import { useUi } from '../../state/uiStore'
import { useLink } from '../../state/linkStore'
import { Icon } from '../Icon'
import { playCue } from '../../audio/engine'
import logoMark from '../../assets/logo-mark-light.png'

const drag = { WebkitAppRegion: 'drag' } as CSSProperties
const noDrag = { WebkitAppRegion: 'no-drag' } as CSSProperties

function statusText(): { text: string; color: string; on: boolean } {
  const s = useLink.getState().status
  switch (s.state) {
    case 'connected':
      return {
        text: s.kind === 'sim' ? '仿真已连接' : `已连接 · ${s.detail ?? s.kind}`,
        color: 'var(--success)',
        on: true
      }
    case 'connecting':
      return { text: '连接中…', color: 'var(--accent)', on: false }
    case 'error':
      return { text: `连接失败：${s.message}`, color: 'var(--danger)', on: false }
    default:
      return { text: '无人机未连接', color: 'var(--danger)', on: false }
  }
}

export function TitleBar(): JSX.Element {
  const route = useUi((s) => s.route)
  const go = useUi((s) => s.go)
  const openConnect = useUi((s) => s.openConnect)
  const setSettingsOpen = useUi((s) => s.setSettingsOpen)
  const status = useLink((s) => s.status)
  const st = statusText()

  return (
    <div
      style={{
        height: 'var(--title-h)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 8px 0 14px',
        background: 'linear-gradient(180deg, rgba(14,21,36,0.92), rgba(8,11,18,0.6))',
        borderBottom: '1px solid var(--stroke)',
        ...drag
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <img
          src={logoMark}
          alt="中影智能"
          style={{ width: 20, height: 20, objectFit: 'contain', filter: 'drop-shadow(0 0 6px var(--primary-glow))' }}
        />
        <span style={{ fontWeight: 700, letterSpacing: '0.14em', fontSize: 13 }}>
          中影<span style={{ color: 'var(--primary)' }}>智能</span>
        </span>
      </div>

      {route !== 'home' && (
        <button
          className="btn ghost"
          style={{ ...noDrag, padding: '4px 10px', fontSize: 13 }}
          onClick={() => {
            playCue('back')
            go('home')
          }}
          onMouseEnter={() => playCue('hover')}
        >
          <Icon name="home" size={16} /> 主菜单
        </button>
      )}

      <div style={{ flex: 1 }} />

      <button
        className="btn ghost"
        style={{
          ...noDrag,
          padding: '4px 12px',
          borderRadius: 'var(--r-pill)',
          border: `1px solid ${st.color}`,
          color: st.color,
          fontSize: 12.5,
          background: 'rgba(0,0,0,0.25)'
        }}
        onClick={openConnect}
        title="连接设置"
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: st.color,
            boxShadow: st.on ? `0 0 8px ${st.color}` : 'none',
            display: 'inline-block',
            marginRight: 6
          }}
        />
        {st.text}
      </button>

      <button
        className="btn ghost"
        style={{ ...noDrag, padding: '4px 8px' }}
        title="界面设置（音效 / 动效）"
        onClick={() => {
          playCue('select')
          setSettingsOpen(true)
        }}
        onMouseEnter={() => playCue('hover')}
      >
        <Icon name="tuning" size={16} />
      </button>

      <div style={{ display: 'flex', gap: 2, ...noDrag }}>
        <WinBtn icon="min" onClick={() => window.gcs.win.minimize()} />
        <WinBtn icon="max" onClick={() => window.gcs.win.maximize()} />
        <WinBtn icon="close" danger onClick={() => window.gcs.win.close()} />
      </div>
    </div>
  )
}

function WinBtn({
  icon,
  onClick,
  danger
}: {
  icon: 'min' | 'max' | 'close'
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 34,
        height: 28,
        display: 'grid',
        placeItems: 'center',
        borderRadius: 6,
        color: 'var(--text-mid)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? 'var(--danger)' : 'var(--bg-3)'
        e.currentTarget.style.color = danger ? '#fff' : 'var(--text-hi)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--text-mid)'
      }}
    >
      <Icon name={icon} size={icon === 'max' ? 13 : 16} />
    </button>
  )
}
