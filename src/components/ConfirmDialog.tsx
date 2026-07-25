import { useEffect } from 'react'
import { Icon } from './Icon'

interface Props {
  title: string
  message: string
  danger?: boolean
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/** 危险操作二次确认弹窗，贴合主题视觉；支持 Enter 确认 / Esc 取消。 */
export function ConfirmDialog({ title, message, danger, confirmLabel = '确认', onConfirm, onCancel }: Props): JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Enter') onConfirm()
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onConfirm, onCancel])

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(4,7,13,0.55)',
        backdropFilter: 'blur(3px)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 200
      }}
    >
      <div className="panel" onClick={(e) => e.stopPropagation()} style={{ width: 340, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Icon name="unlink" size={18} style={{ color: danger ? 'var(--danger)' : 'var(--accent)' }} />
          <span style={{ fontWeight: 700, fontSize: 14.5 }}>{title}</span>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-mid)', lineHeight: 1.6, marginBottom: 18 }}>{message}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onCancel}>
            取消
          </button>
          <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onConfirm} autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
