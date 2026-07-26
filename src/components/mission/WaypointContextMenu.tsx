import { useEffect, useRef } from 'react'
import { useMission } from '../../state/missionStore'
import { Icon, type IconName } from '../Icon'

interface Props {
  seq: number
  x: number
  y: number
  onClose: () => void
}

/** 航点右键菜单：编辑 / 在此后插入 / 以此为基准生成相对坐标 / 删除此点。 */
export function WaypointContextMenu({ seq, x, y, onClose }: Props): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const select = useMission((s) => s.select)
  const insertAfter = useMission((s) => s.insertAfter)
  const deleteWaypoint = useMission((s) => s.deleteWaypoint)
  const openDialog = useMission((s) => s.openDialog)
  const setPendingBase = useMission((s) => s.setPendingBase)
  const setWaypointAsHome = useMission((s) => s.setWaypointAsHome)
  const setWaypointAsReturn = useMission((s) => s.setWaypointAsReturn)

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onEsc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onEsc)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onEsc)
    }
  }, [onClose])

  const item = (icon: IconName, label: string, onClick: () => void, danger?: boolean) => (
    <button
      className="btn ghost"
      style={{
        width: '100%',
        justifyContent: 'flex-start',
        padding: '8px 12px',
        fontSize: 13,
        color: danger ? 'var(--danger)' : 'var(--text-hi)'
      }}
      onClick={() => {
        onClick()
        onClose()
      }}
    >
      <Icon name={icon} size={15} /> {label}
    </button>
  )

  return (
    <div
      ref={ref}
      className="panel"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 190,
        padding: 6,
        zIndex: 150
      }}
    >
      <div style={{ padding: '4px 10px 6px', fontSize: 11, color: 'var(--text-lo)' }}>航点 {seq}</div>
      {item('crosshair', '编辑此点', () => select(seq))}
      {item('plus', '在此点后插入', () => insertAfter(seq))}
      {item('target', '以此为基准生成相对坐标', () => {
        setPendingBase(`wp${seq}`)
        openDialog('relcoord')
      })}
      <div style={{ height: 1, background: 'var(--stroke)', margin: '4px 6px' }} />
      {item('home', '设为起飞点（从航线移出）', () => setWaypointAsHome(seq))}
      {item('rtl', '设为返航点', () => setWaypointAsReturn(seq))}
      <div style={{ height: 1, background: 'var(--stroke)', margin: '4px 6px' }} />
      {item('trash', '删除此点', () => deleteWaypoint(seq), true)}
    </div>
  )
}
