// 航点/航线数据模型（M2 详细实现，M1 先定义类型）

export type TurnMode = 'stop' | 'coordinated' | 'adaptive' // 悬停转弯 / 协调转弯 / 自适应协调转弯（样条平滑）

export interface Waypoint {
  seq: number
  lat: number
  lon: number
  alt: number // 相对高 m
  speed: number // m/s 飞往该点速度
  turnMode: TurnMode
  hoverTime: number // s 悬停时间
  heading: number // 方位角 deg
  actions?: string[]
}

export type FinishAction = 'hover' | 'rtl' | 'land' | 'hoverHome' // 原地悬停 / 返航 / 降落 / 返回起飞点悬停
export type ClimbType = 'vertical' | 'inclined' // 垂直爬升 / 斜线爬升

/** 返航点来源：与起飞点相同（默认）/ 自定义坐标 / 与某航点重合（跟随该航点移动）。 */
export type ReturnPointMode = 'home' | 'custom' | 'waypoint'

export interface Mission {
  name: string
  waypoints: Waypoint[]
  startSpeed: number
  finishAction: FinishAction
  loopCount: number
  infiniteLoop: boolean
  closed: boolean // 航线闭合
  startIndex: number // 航线起始点
  climbType: ClimbType
  returnAlt: number
  returnSpeed: number
  returnPointMode: ReturnPointMode
  returnLat: number | null // returnPointMode==='custom' 时生效
  returnLon: number | null
  returnWaypointSeq: number | null // returnPointMode==='waypoint' 时生效
}

export function emptyMission(name = '新建航点任务'): Mission {
  return {
    name,
    waypoints: [],
    startSpeed: 8,
    finishAction: 'hover',
    loopCount: 1,
    infiniteLoop: false,
    closed: false,
    startIndex: 1,
    climbType: 'vertical',
    returnAlt: 30,
    returnSpeed: 10,
    returnPointMode: 'home',
    returnLat: null,
    returnLon: null,
    returnWaypointSeq: null
  }
}
