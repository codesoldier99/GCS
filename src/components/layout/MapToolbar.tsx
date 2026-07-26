import { useUi, mapProviderMeta } from '../../state/uiStore'
import { useVehicle } from '../../state/vehicleStore'
import { useMapStore } from '../../state/mapStore'
import { Icon, type IconName } from '../Icon'

function Tool({
  icon,
  title,
  active,
  onClick
}: {
  icon: IconName
  title: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button className={`icon-btn${active ? ' active' : ''}`} title={title} onClick={onClick}>
      <Icon name={icon} size={19} />
    </button>
  )
}

/**
 * 地图工具按钮组（不含定位容器）。单独导出是为了在航线飞行模式下，
 * 能和 WaypointToolbar 的按钮拼进同一根竖列，避免两个各自浮动的工具栏在小窗口下互相重叠、
 * 互相盖住对方按钮点不到（反馈原文：屏幕小或窗口缩小时按键前后重叠无法点击）。
 */
export function MapTools(): JSX.Element {
  const mapStyle = useUi((s) => s.mapStyle)
  const follow = useUi((s) => s.follow)
  const toggleFollow = useUi((s) => s.toggleFollow)
  const clearTrack = useVehicle((s) => s.clearTrack)
  const measureMode = useMapStore((s) => s.measureMode)
  const toggleMeasure = useMapStore((s) => s.toggleMeasure)
  const cycleProvider = useUi((s) => s.cycleMapProvider)
  const providerLabel = mapProviderMeta(mapStyle).label

  return (
    <>
      <Tool icon="layers" title={`底图：${providerLabel}（点击切换）`} onClick={cycleProvider} />
      <Tool icon="follow" title="跟随飞机" active={follow} onClick={toggleFollow} />
      <Tool icon="eraser" title="清除飞行轨迹" onClick={clearTrack} />
      <Tool icon="ruler" title={measureMode ? '结束测距' : '测距工具'} active={measureMode} onClick={toggleMeasure} />
      <div style={{ height: 6 }} />
      <ZoomControls />
    </>
  )
}

export function MapToolbar({ corner = 'tr' }: { corner?: 'tr' | 'br' }): JSX.Element {
  return (
    <div
      style={{
        position: 'absolute',
        right: 14,
        ...(corner === 'br' ? { bottom: 128 } : { top: 14 }),
        maxHeight: 'calc(100% - 28px)',
        overflowY: 'auto',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 5,
        paddingRight: 2
      }}
    >
      <MapTools />
    </div>
  )
}

function ZoomControls(): JSX.Element {
  const emit = (delta: number) => {
    window.dispatchEvent(new CustomEvent('map-zoom', { detail: delta }))
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button className="icon-btn" title="放大" onClick={() => emit(1)}>
        <Icon name="plus" size={18} />
      </button>
      <button className="icon-btn" title="缩小" onClick={() => emit(-1)}>
        <Icon name="minus" size={18} />
      </button>
    </div>
  )
}
