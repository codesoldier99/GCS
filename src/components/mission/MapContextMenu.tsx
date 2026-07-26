import { useEffect, useRef } from 'react'
import { useMission } from '../../state/missionStore'
import { Icon, type IconName } from '../Icon'

interface Props {
  lat: number
  lon: number
  x: number
  y: number
  onClose: () => void
}

/** 地图空白处右键菜单：在此加点 / 设置起飞点于此 / 设置返航点于此。 */
export function MapContextMenu({ lat, lon, x, y, onClose }: Props): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const addWaypoint = useMission((s) => s.addWaypoint)
  const setHomeOverride = useMission((s) => s.setHomeOverride)
  const setReturnCustom = useMission((s) => s.setReturnCustom)

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

  const item = (icon: IconName, label: string, onClick: () => void) => (
    <button
      className="btn ghost"
      style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 12px', fontSize: 13 }}
      onClick={() => {
        onClick()
        onClose()
      }}
    >
      <Icon name={icon} size={15} /> {label}
    </button>
  )

  return (
    <div ref={ref} className="panel" style={{ position: 'absolute', left: x, top: y, width: 190, padding: 6, zIndex: 150 }}>
      <div style={{ padding: '4px 10px 6px', fontSize: 11, color: 'var(--text-lo)' }}>地图位置</div>
      {item('plus', '在此添加航点', () => addWaypoint(lat, lon))}
      {item('home', '设置起飞点于此', () => setHomeOverride({ lat, lon }))}
      {item('rtl', '设置返航点于此', () => setReturnCustom({ lat, lon }))}
    </div>
  )
}
