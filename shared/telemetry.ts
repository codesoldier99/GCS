// 主/渲染共享：归一化遥测帧。真机(MAVLink)与仿真产出相同结构，UI 不区分来源。

export type LinkKind = 'sim' | 'serial' | 'udp' | 'tcp'

export type GpsFix =
  | 'none'
  | 'no-fix'
  | '2d'
  | '3d'
  | 'dgps'
  | 'rtk-float'
  | 'rtk-fixed'

/** ArduCopter 模式（数值即 custom_mode）。 */
export interface FlightMode {
  id: number
  /** 中文名，如 "GPS模式" */
  label: string
  /** 英文标识，如 "LOITER" */
  code: string
}

export interface TelemetryFrame {
  /** 单调时间戳 (ms)，由主进程打点 */
  t: number
  connected: boolean
  source: LinkKind

  armed: boolean
  mode: FlightMode

  // 姿态 (弧度)
  roll: number
  pitch: number
  yaw: number // 航向, 0..2π (北为0)
  gpsYaw: number // GPS 航向

  // 位置
  lat: number // 度
  lon: number // 度
  relAlt: number // 相对起飞点高度 m
  amsl: number // 海拔 m
  home: { lat: number; lon: number; alt: number } | null

  // 速度
  vx: number // 北向 m/s
  vy: number // 东向 m/s
  vz: number // 垂直 m/s (下为正的 NED -> UI 用向上正, 已转换)
  groundSpeed: number // 水平地速 m/s
  climb: number // 爬升率 m/s

  // 目标 (期望值, 用于对比)
  targetSpeed: number
  targetAlt: number

  // 电
  voltage: number // V
  current: number // A
  batteryRemaining: number // %

  // GPS
  gpsFix: GpsFix
  satellites: number
  hdop: number

  // 电机 M1..M8 输出 (µs 或百分比, 归一 0..100)
  motors: number[]
  throttle: number // 0..100

  // 振动
  vibration: { x: number; y: number; z: number }

  // 距离
  distanceToHome: number // m
  distanceToTarget: number // m
  altAbove: number // 对地高度 m (无测距时=relAlt)

  // 遥控通道 1..(n)
  rc: number[]

  // 飞行计时 (s, 解锁后累计)
  flightTime: number
}

export function emptyFrame(): TelemetryFrame {
  return {
    t: 0,
    connected: false,
    source: 'sim',
    armed: false,
    mode: { id: 0, label: '姿态模式', code: 'STABILIZE' },
    roll: 0,
    pitch: 0,
    yaw: 0,
    gpsYaw: 0,
    lat: 0,
    lon: 0,
    relAlt: 0,
    amsl: 0,
    home: null,
    vx: 0,
    vy: 0,
    vz: 0,
    groundSpeed: 0,
    climb: 0,
    targetSpeed: 0,
    targetAlt: 0,
    voltage: 0,
    current: 0,
    batteryRemaining: 0,
    gpsFix: 'none',
    satellites: 0,
    hdop: 99,
    motors: [0, 0, 0, 0, 0, 0, 0, 0],
    throttle: 0,
    vibration: { x: 0, y: 0, z: 0 },
    distanceToHome: 0,
    distanceToTarget: 0,
    altAbove: 0,
    rc: [1500, 1500, 1000, 1500],
    flightTime: 0
  }
}
