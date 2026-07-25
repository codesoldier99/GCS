import { useEffect } from 'react'
import { FlightMap } from '../map/FlightMap'
import { MeasureTool } from '../map/MeasureTool'
import { TopStatusBar } from '../layout/TopStatusBar'
import { BottomInstrumentBar } from '../layout/BottomInstrumentBar'
import { MapToolbar } from '../layout/MapToolbar'
import { ActionDock } from '../layout/ActionDock'
import { MissionOverlay } from '../mission/MissionOverlay'
import { WaypointToolbar } from '../mission/WaypointToolbar'
import { RoutePanel } from '../mission/RoutePanel'
import { MissionDialogs } from '../mission/MissionDialogs'
import { useLink } from '../../state/linkStore'
import { useUi } from '../../state/uiStore'
import { Icon } from '../Icon'

/** 飞行界面：手动飞行 / 航线飞行 / 模拟飞行 共用同一布局。 */
export function FlightView({ mode }: { mode: 'manual' | 'mission' | 'sim' }): JSX.Element {
  const connected = useLink((s) => s.status.state === 'connected')
  const connect = useLink((s) => s.connect)
  const openConnect = useUi((s) => s.openConnect)

  // 进入「模拟飞行」若未连接则自动连仿真
  useEffect(() => {
    if (mode === 'sim' && !connected) connect({ kind: 'sim' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <TopStatusBar />
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <FlightMap />
        <MeasureTool />
        {mode === 'mission' || mode === 'sim' ? (
          <>
            <MissionOverlay />
            <RoutePanel />
            <WaypointToolbar />
            <MapToolbar corner="br" />
            <ActionDock left={324} />
            <MissionDialogs />
          </>
        ) : (
          <>
            <ActionDock />
            <MapToolbar />
          </>
        )}
        {!connected && mode !== 'mission' && (
          <button
            onClick={openConnect}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              background: 'rgba(4,7,13,0.45)',
              backdropFilter: 'blur(1px)',
              zIndex: 6,
              cursor: 'pointer'
            }}
          >
            <div className="panel" style={{ padding: '22px 28px', textAlign: 'center', pointerEvents: 'none' }}>
              <Icon name="link" size={30} style={{ color: 'var(--primary)' }} />
              <div style={{ marginTop: 10, fontSize: 15, fontWeight: 600 }}>无人机未连接</div>
              <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--text-mid)' }}>
                点击选择数据源（仿真 / 串口 / UDP / TCP）
              </div>
            </div>
          </button>
        )}
        <BottomInstrumentBar />
      </div>
    </div>
  )
}
