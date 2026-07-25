import { useUi } from '../../state/uiStore'
import { useSettings } from '../../state/settingsStore'
import { playCue } from '../../audio/engine'
import { Icon } from '../Icon'
import { Toggle } from '../mission/fields'

function Slider({
  value,
  onChange,
  disabled,
  onCommit
}: {
  value: number
  onChange: (v: number) => void
  disabled?: boolean
  onCommit?: () => void
}) {
  return (
    <input
      type="range"
      min={0}
      max={100}
      value={Math.round(value * 100)}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value) / 100)}
      onMouseUp={onCommit}
      onKeyUp={onCommit}
      className="zy-range"
      style={{ width: '100%', opacity: disabled ? 0.4 : 1 }}
    />
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontSize: 13.5, color: 'var(--text-hi)' }}>{label}</span>
        {children}
      </div>
      {hint && (
        <div style={{ fontSize: 11.5, color: 'var(--text-lo)', marginTop: 5, lineHeight: 1.6 }}>{hint}</div>
      )}
    </div>
  )
}

export function SettingsDialog(): JSX.Element | null {
  const open = useUi((s) => s.settingsOpen)
  const close = useUi((s) => s.setSettingsOpen)
  const s = useSettings()

  if (!open) return null

  return (
    <div
      onClick={() => close(false)}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(4,7,13,0.55)',
        backdropFilter: 'blur(3px)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 210
      }}
    >
      <div className="panel" onClick={(e) => e.stopPropagation()} style={{ width: 400, padding: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '13px 16px',
            borderBottom: '1px solid var(--stroke)'
          }}
        >
          <Icon name="tuning" size={17} style={{ color: 'var(--primary)', marginRight: 9 }} />
          <span style={{ fontWeight: 700, fontSize: 14.5, flex: 1 }}>界面设置</span>
          <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => close(false)}>
            <Icon name="close" size={15} />
          </button>
        </div>

        <div style={{ padding: 18 }}>
          <div className="label" style={{ color: 'var(--primary)', marginBottom: 12 }}>
            声音
          </div>

          <Row label="界面音效" hint="教室内多台机器同时使用时，可在此一键静音。">
            <Toggle
              value={s.soundOn}
              onChange={(v) => {
                s.set('soundOn', v)
                if (v) playCue('toggle')
              }}
            />
          </Row>

          <Row label={`界面音量　${Math.round(s.uiVolume * 100)}%`}>
            <div style={{ width: 170 }}>
              <Slider
                value={s.uiVolume}
                disabled={!s.soundOn}
                onChange={(v) => s.set('uiVolume', v)}
                onCommit={() => s.soundOn && playCue('hover')}
              />
            </div>
          </Row>

          <Row
            label={`飞行告警音量　${Math.round(s.alertVolume * 100)}%`}
            hint="⚠ 告警音独立于界面音效：即使关闭界面音效，电压/失控等安全告警仍会发声。建议不要调至 0。"
          >
            <div style={{ width: 170 }}>
              <Slider
                value={s.alertVolume}
                onChange={(v) => s.set('alertVolume', v)}
                onCommit={() => playCue('alert')}
              />
            </div>
          </Row>

          <button
            className="btn"
            style={{ width: '100%', marginBottom: 20 }}
            onClick={() => playCue('select')}
          >
            <Icon name="play" size={15} /> 试听界面音效
          </button>

          <div className="label" style={{ color: 'var(--primary)', marginBottom: 12 }}>
            动效
          </div>

          <Row
            label="精简动效"
            hint="关闭环形菜单展开、页面过渡等动画。低配笔记本上可提升流畅度。"
          >
            <Toggle
              value={s.reducedMotion}
              onChange={(v) => {
                s.set('reducedMotion', v)
                if (s.soundOn) playCue('toggle')
              }}
            />
          </Row>

          <button
            className="btn"
            style={{ width: '100%', marginTop: 4 }}
            onClick={() => {
              s.reset()
              playCue('back')
            }}
          >
            恢复默认设置
          </button>
        </div>
      </div>

      <style>{`
        .zy-range{ -webkit-appearance:none; appearance:none; height:4px; border-radius:2px;
          background:var(--bg-3); outline:none; }
        .zy-range::-webkit-slider-thumb{ -webkit-appearance:none; appearance:none;
          width:15px; height:15px; border-radius:50%; background:var(--primary);
          box-shadow:0 0 8px var(--primary-glow); cursor:pointer; }
        .zy-range:disabled::-webkit-slider-thumb{ background:var(--text-lo); box-shadow:none; cursor:not-allowed; }
      `}</style>
    </div>
  )
}
