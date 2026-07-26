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

/**
 * 规划用的"返航点"：未单独设置时与起飞点相同；设为自定义坐标或与某航点重合时，
 * 使用对应坐标（与该航点重合的返航点会随航点移动/重排自动更新，见 missionStore.remapReturnSeq）。
 */
export function getEffectiveReturnPoint(): LL | null {
  const { mission } = useMission.getState()
  if (mission.returnPointMode === 'custom' && mission.returnLat != null && mission.returnLon != null) {
    return { lat: mission.returnLat, lon: mission.returnLon }
  }
  if (mission.returnPointMode === 'waypoint' && mission.returnWaypointSeq != null) {
    const w = mission.waypoints.find((x) => x.seq === mission.returnWaypointSeq)
    if (w) return { lat: w.lat, lon: w.lon }
  }
  return getEffectiveHome()
}

/** React 组件里响应式获取 effective return point。 */
export function useEffectiveReturnPoint(): LL | null {
  const mode = useMission((s) => s.mission.returnPointMode)
  const returnLat = useMission((s) => s.mission.returnLat)
  const returnLon = useMission((s) => s.mission.returnLon)
  const returnSeq = useMission((s) => s.mission.returnWaypointSeq)
  const waypoints = useMission((s) => s.mission.waypoints)
  const home = useEffectiveHome()
  if (mode === 'custom' && returnLat != null && returnLon != null) return { lat: returnLat, lon: returnLon }
  if (mode === 'waypoint' && returnSeq != null) {
    const w = waypoints.find((x) => x.seq === returnSeq)
    if (w) return { lat: w.lat, lon: w.lon }
  }
  return home
}

/** 当前返航点是否与起飞点不同（用于决定是否要在地图上单独画一个返航点标记）。 */
export function useReturnDiffersFromHome(): boolean {
  const mode = useMission((s) => s.mission.returnPointMode)
  return mode !== 'home'
}
