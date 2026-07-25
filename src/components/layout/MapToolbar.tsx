import { useUi } from '../../state/uiStore'
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

export function MapToolbar({ corner = 'tr' }: { corner?: 'tr' | 'br' }): JSX.Element {
  const mapStyle = useUi((s) => s.mapStyle)
  const setMapStyle = useUi((s) => s.setMapStyle)
  const follow = useUi((s) => s.follow)
  const toggleFollow = useUi((s) => s.toggleFollow)
  const clearTrack = useVehicle((s) => s.clearTrack)
  const measureMode = useMapStore((s) => s.measureMode)
  const toggleMeasure = useMapStore((s) => s.toggleMeasure)

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
      <Tool
        icon="layers"
        title={mapStyle === 'esri-sat' ? '切换街道图' : '切换卫星图'}
        onClick={() => setMapStyle(mapStyle === 'esri-sat' ? 'osm' : 'esri-sat')}
      />
      <Tool icon="follow" title="跟随飞机" active={follow} onClick={toggleFollow} />
      <Tool icon="eraser" title="清除飞行轨迹" onClick={clearTrack} />
      <Tool icon="ruler" title={measureMode ? '结束测距' : '测距工具'} active={measureMode} onClick={toggleMeasure} />
      <div style={{ height: 6 }} />
      <ZoomControls />
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
