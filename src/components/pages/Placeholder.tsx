import { Icon } from '../Icon'
import { useUi } from '../../state/uiStore'

export function Placeholder({ title, subtitle }: { title: string; subtitle: string }): JSX.Element {
  const go = useUi((s) => s.go)
  return (
    <div
      style={{
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        textAlign: 'center',
        padding: 40
      }}
    >
      <div>
        <div
          style={{
            width: 84,
            height: 84,
            margin: '0 auto 20px',
            borderRadius: 20,
            display: 'grid',
            placeItems: 'center',
            border: '1px solid var(--stroke)',
            background: 'var(--bg-2)',
            color: 'var(--primary)',
            boxShadow: 'inset 0 1px 0 var(--stroke-hi), 0 0 26px rgba(23,212,230,0.18)'
          }}
        >
          <Icon name="wizard" size={40} />
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: 24 }}>{title}</h2>
        <div style={{ color: 'var(--text-mid)', fontSize: 14, maxWidth: 520, lineHeight: 1.7 }}>
          {subtitle}
        </div>
        <button className="btn" style={{ marginTop: 24 }} onClick={() => go('home')}>
          <Icon name="chevron-left" size={16} /> 返回主菜单
        </button>
      </div>
    </div>
  )
}
