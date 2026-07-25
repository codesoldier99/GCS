import { useRef, useState, type ReactNode } from 'react'
import { Icon } from '../Icon'

interface Props {
  title: string
  onClose: () => void
  width?: number
  initial?: { x: number; y: number }
  children: ReactNode
  footer?: ReactNode
}

/**
 * 可拖动的浮动工具面板：不带遮罩，不挡地图交互/视野，标题栏可拖拽移动。
 * 用于需要一边看地图一边操作的工具（相对坐标编辑器/航线变换/航线模板）。
 */
export function FloatingPanel({ title, onClose, width = 340, initial, children, footer }: Props): JSX.Element {
  const [pos, setPos] = useState(initial ?? { x: window.innerWidth - width - 76, y: 60 })
  const dragRef = useRef<{ dx: number; dy: number } | null>(null)

  const onHeaderDown = (e: React.MouseEvent): void => {
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }
    const onMove = (ev: MouseEvent): void => {
      if (!dragRef.current) return
      setPos({
        x: Math.min(Math.max(0, ev.clientX - dragRef.current.dx), window.innerWidth - 60),
        y: Math.min(Math.max(0, ev.clientY - dragRef.current.dy), window.innerHeight - 40)
      })
    }
    const onUp = (): void => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      className="panel"
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width,
        padding: 0,
        zIndex: 130,
        maxHeight: 'calc(100vh - 40px)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div
        onMouseDown={onHeaderDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '11px 14px',
          borderBottom: '1px solid var(--stroke)',
          cursor: 'grab',
          userSelect: 'none'
        }}
      >
        <Icon name="grip" size={14} style={{ color: 'var(--text-lo)', marginRight: 8 }} />
        <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{title}</span>
        <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={onClose}>
          <Icon name="close" size={14} />
        </button>
      </div>
      <div style={{ padding: 16, overflowY: 'auto' }}>{children}</div>
      {footer && <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '0 16px 16px' }}>{footer}</div>}
    </div>
  )
}
