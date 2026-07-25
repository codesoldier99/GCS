import { emptyFrame, type TelemetryFrame } from '../../shared/telemetry'
import type {
  CalProgress,
  MissionProgress,
  MissionUploadOptions,
  ParamEntry,
  ParamLoadProgress,
  VehicleCommand
} from '../../shared/protocol'
import type { Waypoint } from '../../shared/mission'
import { modeById } from '../../shared/modeMap'
import { DEFAULT_PARAMS } from './simParams'

const R_EARTH = 6371000

function metersToLat(m: number): number {
  return m / 111320
}
function metersToLon(m: number, lat: number): number {
  return m / (111320 * Math.cos((lat * Math.PI) / 180))
}
function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)))
}

function bearingDeg(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const y = Math.sin(dLon) * Math.cos(la2)
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon)
  return (Math.atan2(y, x) * 180) / Math.PI
}

type Phase = 'ground' | 'takeoff' | 'cruise' | 'circle' | 'rtl' | 'land' | 'mission' | 'figure8' | 'hoverHome'

/**
 * SITL 式仿真：以 ~25Hz 积分一个简化多旋翼模型，产出与真机一致的 TelemetryFrame。
 * 支持指令：arm / setMode / takeoff / rtl / land / simFly（一键演示：起飞并绕圈）。
 */
export class Simulator {
  private timer: NodeJS.Timeout | null = null
  private onFrame: (f: TelemetryFrame) => void
  private readonly HZ = 25
  private t0 = Date.now()

  // 训练场默认位置（对应 GCS.pdf 示例）
  private home = { lat: 22.889482, lon: 113.400647, alt: 18 }

  private s = {
    lat: 22.889482,
    lon: 113.400647,
    relAlt: 0,
    yaw: 0, // rad
    roll: 0,
    pitch: 0,
    vN: 0,
    vE: 0,
    vD: 0,
    armed: false,
    modeId: 0,
    phase: 'ground' as Phase,
    circleAngle: 0,
    battery: 96, // %
    voltage: 25.2,
    sats: 0,
    flightTime: 0,
    targetAlt: 30
  }

  private mission: Waypoint[] = []
  private missionIdx = 0
  private missionHover = 0
  private finishAction: 'hover' | 'rtl' | 'land' | 'hoverHome' = 'hover'
  private missionLoopCount = 1
  private missionInfiniteLoop = false
  private missionLoopsDone = 0

  private fig: { center: { lat: number; lon: number }; r: number; bAB: number; alt: number; u: number } | null =
    null

  private params: Record<string, number> = { ...DEFAULT_PARAMS }
  private calTimer: NodeJS.Timeout | null = null
  onCalProgress?: (p: CalProgress) => void

  constructor(onFrame: (f: TelemetryFrame) => void) {
    this.onFrame = onFrame
  }

  refreshParams(onProgress: (p: ParamLoadProgress) => void): ParamEntry[] {
    const entries = Object.entries(this.params)
    const total = entries.length
    entries.forEach((_, i) => onProgress({ received: i + 1, total, done: i === total - 1 }))
    return entries.map(([id, value]) => ({ id, value, type: 9 }))
  }

  setParam(id: string, value: number): number {
    this.params[id] = value
    // 机架/电压等即时反映到状态（演示用）
    return value
  }

  private startCompassCal(): void {
    if (this.calTimer) clearInterval(this.calTimer)
    let pct = 0
    this.onCalProgress?.({ kind: 'compass', percent: 0, done: false, success: false })
    this.calTimer = setInterval(() => {
      pct += 4 + Math.random() * 4
      if (pct >= 100) {
        pct = 100
        this.onCalProgress?.({ kind: 'compass', percent: 100, done: true, success: true, message: '校准成功' })
        if (this.calTimer) clearInterval(this.calTimer)
        this.calTimer = null
      } else {
        this.onCalProgress?.({ kind: 'compass', percent: Math.round(pct), done: false, success: false })
      }
    }, 250)
  }

  private cancelCompassCal(): void {
    if (this.calTimer) clearInterval(this.calTimer)
    this.calTimer = null
    this.onCalProgress?.({ kind: 'compass', percent: 0, done: true, success: false, message: '已取消' })
  }

  uploadMission(
    wps: Waypoint[],
    opts: MissionUploadOptions,
    onProgress: (p: MissionProgress) => void
  ): MissionProgress {
    this.mission = wps.map((w) => ({ ...w }))
    if (opts.closed && wps.length > 0) this.mission.push({ ...wps[0] })
    this.finishAction = opts.finishAction
    this.missionLoopCount = opts.loopCount
    this.missionInfiniteLoop = opts.infiniteLoop
    this.missionLoopsDone = 0
    const total = wps.length
    for (let i = 1; i <= total; i++) {
      onProgress({ phase: 'upload', current: i, total, done: i === total })
    }
    return { phase: 'upload', current: total, total, done: true }
  }

  downloadMission(): Waypoint[] {
    return this.mission.map((w) => ({ ...w }))
  }

  /** 到达当前航点后前进到下一个；若已飞完且还有循环次数剩余（或无限循环），绕回航线起点。 */
  private advanceMissionIndex(): void {
    this.missionIdx++
    if (this.missionIdx >= this.mission.length && this.mission.length > 0) {
      const moreLoops = this.missionInfiniteLoop || this.missionLoopsDone < this.missionLoopCount - 1
      if (moreLoops) {
        this.missionLoopsDone++
        this.missionIdx = 0
      }
    }
  }

  start(): void {
    this.t0 = Date.now()
    this.timer = setInterval(() => this.tick(1 / this.HZ), 1000 / this.HZ)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    if (this.calTimer) clearInterval(this.calTimer)
    this.timer = null
    this.calTimer = null
  }

  command(cmd: VehicleCommand): void {
    switch (cmd.type) {
      case 'arm':
        this.s.armed = cmd.arm
        if (cmd.arm) {
          this.home = { lat: this.s.lat, lon: this.s.lon, alt: this.home.alt }
          this.s.flightTime = 0
        } else if (this.s.relAlt < 0.5) {
          this.s.phase = 'ground'
        }
        break
      case 'setMode':
        this.s.modeId = cmd.modeId
        if (cmd.modeId === 6) this.s.phase = 'rtl'
        if (cmd.modeId === 9) this.s.phase = 'land'
        if (cmd.modeId === 3 && this.mission.length > 0) {
          // 自动模式：从当前高度起飞并顺序飞航点
          this.s.armed = true
          if (this.s.relAlt < 1) {
            this.home = { lat: this.s.lat, lon: this.s.lon, alt: this.home.alt }
            this.s.targetAlt = this.mission[0].alt
            this.s.phase = 'takeoff'
          } else {
            this.s.phase = 'mission'
          }
          this.missionIdx = 0
          this.missionHover = 0
          this.missionLoopsDone = 0
        }
        break
      case 'takeoff':
        this.s.armed = true
        this.s.targetAlt = cmd.alt
        this.s.phase = 'takeoff'
        break
      case 'rtl':
        this.s.phase = 'rtl'
        this.s.modeId = 6
        break
      case 'land':
        this.s.phase = 'land'
        this.s.modeId = 9
        break
      case 'compassCal':
        if (cmd.start) this.startCompassCal()
        else this.cancelCompassCal()
        break
      case 'simFigure8':
        if (cmd.enable) {
          const center = {
            lat: (cmd.a.lat + cmd.b.lat) / 2,
            lon: (cmd.a.lon + cmd.b.lon) / 2
          }
          const r = haversine({ lat: cmd.a.lat, lon: cmd.a.lon }, center)
          const bAB = bearingDeg({ lat: cmd.a.lat, lon: cmd.a.lon }, { lat: cmd.b.lat, lon: cmd.b.lon })
          this.fig = { center, r, bAB, alt: cmd.alt, u: 0 }
          this.s.armed = true
          this.home = { lat: this.s.lat, lon: this.s.lon, alt: this.home.alt }
          this.s.targetAlt = cmd.alt
          this.s.modeId = 5
          this.s.phase = this.s.relAlt < 1 ? 'takeoff' : 'figure8'
          this.s.flightTime = 0
        } else {
          this.fig = null
          this.s.phase = 'rtl'
          this.s.modeId = 6
        }
        break
      case 'simFly':
        if (cmd.enable) {
          this.s.armed = true
          this.home = { lat: this.s.lat, lon: this.s.lon, alt: this.home.alt }
          this.s.targetAlt = 30
          this.s.phase = 'takeoff'
          this.s.modeId = 5
          this.s.flightTime = 0
        } else {
          this.s.phase = 'rtl'
          this.s.modeId = 6
        }
        break
    }
  }

  private tick(dt: number): void {
    const s = this.s

    // GPS 逐渐搜星
    if (s.sats < 18) s.sats = Math.min(18, s.sats + dt * 6)

    if (s.armed) s.flightTime += dt

    const climbRate = 2.5
    const cruiseSpeed = 6

    switch (s.phase) {
      case 'ground':
        s.relAlt = Math.max(0, s.relAlt - climbRate * dt)
        s.roll = s.pitch = 0
        s.vN = s.vE = s.vD = 0
        break

      case 'takeoff': {
        s.relAlt += climbRate * dt
        s.vD = -climbRate
        s.pitch = -0.03
        if (s.relAlt >= s.targetAlt) {
          s.relAlt = s.targetAlt
          s.phase = this.fig
            ? 'figure8'
            : s.modeId === 3 && this.mission.length > 0
              ? 'mission'
              : 'circle'
          s.vD = 0
        }
        break
      }

      case 'figure8': {
        if (!this.fig) {
          s.phase = 'circle'
          break
        }
        const fig = this.fig
        const speed = 5
        const circumference = 4 * Math.PI * fig.r // 两圆周长
        fig.u = (fig.u + (speed / circumference) * dt) % 1
        // 局部 x(沿 A→B)/y
        const r = fig.r
        let x: number
        let y: number
        if (fig.u < 0.5) {
          const t = (fig.u / 0.5) * Math.PI * 2
          x = -r + r * Math.cos(t)
          y = r * Math.sin(t)
        } else {
          const t = Math.PI - ((fig.u - 0.5) / 0.5) * Math.PI * 2
          x = r + r * Math.cos(t)
          y = r * Math.sin(t)
        }
        const th = (fig.bAB * Math.PI) / 180
        const north = x * Math.cos(th) - y * Math.sin(th)
        const east = x * Math.sin(th) + y * Math.cos(th)
        const tgtLat = fig.center.lat + metersToLat(north)
        const tgtLon = fig.center.lon + metersToLon(east, fig.center.lat)
        // 朝目标点移动（含少量噪声，模拟真实飞行）
        const dN = (tgtLat - s.lat) * 111320
        const dE = (tgtLon - s.lon) * 111320 * Math.cos((s.lat * Math.PI) / 180)
        s.vN = dN / dt + (Math.random() - 0.5) * 0.3
        s.vE = dE / dt + (Math.random() - 0.5) * 0.3
        const spd = Math.hypot(s.vN, s.vE)
        if (spd > speed * 1.6) {
          s.vN *= (speed * 1.6) / spd
          s.vE *= (speed * 1.6) / spd
        }
        s.yaw = Math.atan2(s.vE, s.vN)
        s.roll = 0.25
        s.relAlt = fig.alt + (Math.random() - 0.5) * 0.2
        s.vD = 0
        break
      }

      case 'mission': {
        const wp = this.mission[this.missionIdx]
        if (!wp) {
          // 航线完成 → 完成动作
          if (this.finishAction === 'rtl') {
            s.phase = 'rtl'
            s.modeId = 6
          } else if (this.finishAction === 'land') {
            s.phase = 'land'
            s.modeId = 9
          } else if (this.finishAction === 'hoverHome') {
            s.phase = 'hoverHome'
          } else {
            s.vN = s.vE = 0
            s.roll = 0
          }
          break
        }
        const target = { lat: wp.lat, lon: wp.lon }
        const d = haversine({ lat: s.lat, lon: s.lon }, target)
        // 高度趋近
        if (Math.abs(wp.alt - s.relAlt) > 0.3) {
          const dir = wp.alt > s.relAlt ? 1 : -1
          s.relAlt += dir * Math.min(climbRate, Math.abs(wp.alt - s.relAlt) / dt) * dt
          s.vD = -dir * climbRate
        } else {
          s.relAlt = wp.alt
          s.vD = 0
        }
        // 悬停转弯需飞近才算到点；协调/自适应转弯用更大的到点半径，掠过而不停顿
        const arriveR = wp.turnMode === 'stop' ? 2 : 6
        if (d > arriveR) {
          const brg = bearingDeg({ lat: s.lat, lon: s.lon }, target)
          s.yaw = (brg * Math.PI) / 180
          const spd = Math.min(wp.speed, Math.max(2, d))
          s.vN = Math.cos(s.yaw) * spd
          s.vE = Math.sin(s.yaw) * spd
          s.roll = wp.turnMode === 'stop' ? 0.2 : 0.32 // 协调/自适应转弯坡度更大，视觉上更"甩弯"
        } else if (wp.turnMode === 'stop' || wp.hoverTime > 0) {
          // 到点：悬停（悬停转弯必停；其余模式仅在显式设置了悬停时间时才停）
          s.vN = s.vE = 0
          s.roll = 0
          this.missionHover += dt
          if (this.missionHover >= (wp.hoverTime || 0)) {
            this.missionHover = 0
            this.advanceMissionIndex()
          }
        } else {
          this.advanceMissionIndex()
        }
        break
      }

      case 'hoverHome': {
        // 返回起飞点后原地无限悬停（不降落/不切RTL模式）
        const target = 30
        if (s.relAlt < target - 0.5) {
          s.relAlt += climbRate * dt
          s.vD = -climbRate
        }
        const d = haversine({ lat: s.lat, lon: s.lon }, this.home)
        if (d > 1.5) {
          const brg = bearingDeg({ lat: s.lat, lon: s.lon }, this.home)
          s.yaw = (brg * Math.PI) / 180
          s.vN = Math.cos(s.yaw) * cruiseSpeed
          s.vE = Math.sin(s.yaw) * cruiseSpeed
          s.roll = 0.15
        } else {
          s.vN = s.vE = 0
          s.roll = 0
          s.vD = 0
        }
        break
      }

      case 'circle': {
        // 绕半径 40m 圆飞行
        const radius = 40
        const omega = cruiseSpeed / radius
        s.circleAngle += omega * dt
        const centerN = 0
        const centerE = radius
        // 目标位置（相对 home，NE 米）
        const posN = centerN + radius * Math.sin(s.circleAngle) - 0
        const posE = centerE - radius * Math.cos(s.circleAngle)
        // 当前相对 home 的 NE
        const curN = haversine({ lat: this.home.lat, lon: s.lon }, { lat: s.lat, lon: s.lon }) *
          (s.lat >= this.home.lat ? 1 : -1)
        const curE = haversine({ lat: s.lat, lon: this.home.lon }, { lat: s.lat, lon: s.lon }) *
          (s.lon >= this.home.lon ? 1 : -1)
        s.vN = (posN - curN) * 0.9 + cruiseSpeed * Math.cos(s.circleAngle) * 0.1
        s.vE = (posE - curE) * 0.9 + cruiseSpeed * Math.sin(s.circleAngle) * 0.1
        // 航向指向速度方向
        s.yaw = Math.atan2(s.vE, s.vN)
        s.roll = 0.28 // 盘旋坡度
        s.pitch = -0.06
        s.vD = 0
        break
      }

      case 'rtl': {
        // 爬到返航高度后飞回 home 再降落
        const target = 30
        if (s.relAlt < target - 0.5) {
          s.relAlt += climbRate * dt
          s.vD = -climbRate
        }
        const d = haversine({ lat: s.lat, lon: s.lon }, this.home)
        if (d > 1.5) {
          const brg = Math.atan2(
            metersToLon(1, s.lat) === 0 ? 0 : (this.home.lon - s.lon),
            this.home.lat - s.lat
          )
          s.yaw = brg
          s.vN = Math.cos(brg) * cruiseSpeed
          s.vE = Math.sin(brg) * cruiseSpeed
          s.roll = 0.15
        } else {
          s.vN = s.vE = 0
          s.roll = 0
          s.phase = 'land'
        }
        break
      }

      case 'land': {
        s.relAlt = Math.max(0, s.relAlt - 1.2 * dt)
        s.vD = 1.2
        s.vN = s.vE = 0
        s.roll = s.pitch = 0
        if (s.relAlt <= 0.05) {
          s.relAlt = 0
          s.armed = false
          s.phase = 'ground'
          s.modeId = 0
        }
        break
      }

      case 'cruise':
        break
    }

    // 积分位置
    s.lat += metersToLat(s.vN * dt)
    s.lon += metersToLon(s.vE * dt, s.lat)

    // 电量缓慢下降
    if (s.armed) {
      s.battery = Math.max(0, s.battery - dt * 0.05)
      s.voltage = 21.0 + (s.battery / 100) * 4.4
    }

    this.onFrame(this.buildFrame())
  }

  private buildFrame(): TelemetryFrame {
    const s = this.s
    const f = emptyFrame()
    f.t = Date.now() - this.t0
    f.connected = true
    f.source = 'sim'
    f.armed = s.armed
    f.mode = modeById(s.modeId)
    f.roll = s.roll
    f.pitch = s.pitch
    f.yaw = (s.yaw + Math.PI * 2) % (Math.PI * 2)
    f.gpsYaw = f.yaw
    f.lat = s.lat
    f.lon = s.lon
    f.relAlt = s.relAlt
    f.amsl = this.home.alt + s.relAlt
    f.home = { ...this.home }
    f.vx = s.vN
    f.vy = s.vE
    f.vz = -s.vD // 向上为正
    f.groundSpeed = Math.hypot(s.vN, s.vE)
    f.climb = -s.vD
    f.targetSpeed = s.phase === 'circle' ? 6 : 0
    f.targetAlt = s.targetAlt
    f.voltage = s.voltage
    f.current = s.armed ? 18 + Math.random() * 3 : 0.4
    f.batteryRemaining = s.battery
    f.gpsFix = s.sats >= 6 ? '3d' : s.sats > 0 ? '2d' : 'no-fix'
    f.satellites = Math.round(s.sats)
    f.hdop = s.sats >= 10 ? 0.8 : 2.5
    // 电机输出：基础油门 + 姿态混控 + 噪声
    const base = s.armed ? 45 + s.relAlt * 0.05 + f.climb * 3 : 0
    f.throttle = Math.max(0, Math.min(100, base))
    f.motors = Array.from({ length: 8 }, (_, i) => {
      if (!s.armed) return 0
      const mix = Math.sin(s.circleAngle + i) * s.roll * 20
      return Math.max(0, Math.min(100, base + mix + (Math.random() - 0.5) * 2))
    })
    const vib = s.armed ? 12 + Math.random() * 6 : 2 + Math.random()
    f.vibration = { x: vib, y: vib * 0.9 + Math.random(), z: vib * 1.1 + Math.random() }
    f.distanceToHome = haversine({ lat: s.lat, lon: s.lon }, this.home)
    f.distanceToTarget = 0
    f.altAbove = s.relAlt
    f.rc = [1500, 1500, s.armed ? 1500 : 1000, 1500, s.modeId >= 5 ? 2000 : 1000]
    f.flightTime = s.flightTime
    return f
  }
}
