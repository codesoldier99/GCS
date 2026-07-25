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
import { SettingsDialog } from './components/settings/SettingsDialog'
import { useSettings } from './state/settingsStore'
import { unlockAudio } from './audio/engine'

export function App(): JSX.Element {
  const route = useUi((s) => s.route)
  const reducedMotion = useSettings((s) => s.reducedMotion)

  useEffect(() => wireTelemetry(), [])

  // 自动播放策略：AudioContext 必须在用户手势后才能出声，首次交互时解锁一次即可
  useEffect(() => {
    const unlock = (): void => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  // 把「精简动效」写到根元素，供 CSS 降级规则使用
  useEffect(() => {
    const root = document.documentElement
    if (reducedMotion) root.setAttribute('data-motion', 'reduced')
    else root.removeAttribute('data-motion')
  }, [reducedMotion])

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
      <SettingsDialog />
    </>
  )
}
