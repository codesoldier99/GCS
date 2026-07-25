import { useState } from 'react'
import { CaacExam } from './CaacExam'
import { LogReplay } from './LogReplay'
import { useUi } from '../../state/uiStore'
import { Icon } from '../Icon'

type Tab = 'exam' | 'replay'

export function CaacPage(): JSX.Element {
  const [tab, setTab] = useState<Tab>('exam')
  const go = useUi((s) => s.go)

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 22px',
          borderBottom: '1px solid var(--stroke)',
          background: 'rgba(11,17,30,0.7)',
          zIndex: 6
        }}
      >
        <Icon name="caac" size={19} style={{ color: 'var(--accent)' }} />
        <span style={{ fontWeight: 700, fontSize: 15, marginRight: 10 }}>CAAC 训练</span>
        {(
          [
            ['exam', '绕八字飞行考试'],
            ['replay', '飞行日志回放']
          ] as [Tab, string][]
        ).map(([t, l]) => (
          <button
            key={t}
            className="btn"
            onClick={() => setTab(t)}
            style={{
              padding: '6px 14px',
              background: tab === t ? 'var(--primary-dim)' : 'transparent',
              borderColor: tab === t ? 'var(--primary)' : 'var(--stroke)',
              color: tab === t ? 'var(--primary)' : 'var(--text-mid)'
            }}
          >
            {l}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={() => go('home')}>
          <Icon name="home" size={16} /> 主菜单
        </button>
      </div>

      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {tab === 'exam' ? <CaacExam /> : <LogReplay />}
      </div>
    </div>
  )
}
