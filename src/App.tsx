import { useEffect } from 'react'
import { wireTelemetry } from './state/linkStore'
import { useUi } from './state/uiStore'
import { useVehicle } from './state/vehicleStore'
import { useLog } from './state/logStore'
import { CaacPage } from './components/caac/CaacPage'
import { TitleBar } from './components/layout/TitleBar'
import { HomeMenu } from './components/pages/HomeMenu'
import { FlightView } from './components/pages/FlightView'
import { ConnectDialog } from './components/connection/ConnectDialog'
import { SetupWizard } from './components/wizard/SetupWizard'
import { Tuning } from './components/tuning/Tuning'
import { ErrorBoundary } from './components/ErrorBoundary'

export function App(): JSX.Element {
  const route = useUi((s) => s.route)

  useEffect(() => wireTelemetry(), [])

  // 飞行日志录制：订阅遥测帧写入日志缓冲（回放模式除外）
  useEffect(
    () =>
      useVehicle.subscribe((s) => {
        if (!useVehicle.getState().replayMode) useLog.getState().record(s.frame)
      }),
    []
  )

  return (
    <>
      <TitleBar />
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <ErrorBoundary onReset={() => useUi.getState().go('home')}>
          {route === 'home' && <HomeMenu />}
          {(route === 'manual' || route === 'mission' || route === 'sim') && (
            <FlightView mode={route} />
          )}
          {route === 'wizard' && <SetupWizard />}
          {route === 'tuning' && <Tuning />}
          {route === 'caac' && <CaacPage />}
        </ErrorBoundary>
      </div>
      <ConnectDialog />
    </>
  )
}
