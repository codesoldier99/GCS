import type { LL } from './geo'
import { useVehicle } from '../state/vehicleStore'
import { useMission } from '../state/missionStore'

/**
 * 规划用的"起飞点"：已连接飞控并收到 HOME_POSITION 时用遥测真实 home；
 * 否则（多数学员场景：尚未连接真机/仿真）回退到手动设置的起飞点。
 */
export function getEffectiveHome(): LL | null {
  const telHome = useVehicle.getState().frame.home
  if (telHome) return { lat: telHome.lat, lon: telHome.lon }
  return useMission.getState().homeOverride
}

/** React 组件里响应式获取 effective home（随遥测/手动起飞点变化重渲染）。 */
export function useEffectiveHome(): LL | null {
  const telHome = useVehicle((s) => s.frame.home)
  const override = useMission((s) => s.homeOverride)
  if (telHome) return { lat: telHome.lat, lon: telHome.lon }
  return override
}
