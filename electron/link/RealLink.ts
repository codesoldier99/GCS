import { createSocket, type Socket } from 'node:dgram'
import { Socket as TcpSocket } from 'node:net'
import { MavLinkPacketSplitter, MavLinkPacketParser, MavLinkProtocolV2 } from 'node-mavlink'
import { minimal, common, ardupilotmega } from 'mavlink-mappings'
import type { MavLinkData } from 'mavlink-mappings'
import type {
  CalProgress,
  ConnectOptions,
  LinkStatus,
  MissionProgress,
  MissionUploadOptions,
  ParamEntry,
  ParamLoadProgress,
  VehicleCommand
} from '../../shared/protocol'
import type { Waypoint } from '../../shared/mission'
import { emptyFrame, type GpsFix, type TelemetryFrame } from '../../shared/telemetry'
import { modeById } from '../../shared/modeMap'

const REGISTRY: Record<number, new () => MavLinkData> = {
  ...(minimal.REGISTRY as Record<number, new () => MavLinkData>),
  ...(common.REGISTRY as Record<number, new () => MavLinkData>),
  ...(ardupilotmega.REGISTRY as Record<number, new () => MavLinkData>)
}

const ARMED_FLAG = 128 // MAV_MODE_FLAG_SAFETY_ARMED

const MISSION_IDS = new Set<number>([
  common.MissionCount.MSG_ID,
  common.MissionRequest.MSG_ID,
  common.MissionRequestInt.MSG_ID,
  common.MissionItemInt.MSG_ID,
  common.MissionAck.MSG_ID
])

function gpsFix(n: number): GpsFix {
  return (['no-fix', 'no-fix', '2d', '3d', 'dgps', 'rtk-float', 'rtk-fixed'][n] ?? 'no-fix') as GpsFix
}

interface Callbacks {
  onFrame: (f: TelemetryFrame) => void
  onStatus: (s: LinkStatus) => void
  onCalProgress: (p: CalProgress) => void
}

function normParamId(raw: unknown): string {
  if (Array.isArray(raw)) {
    return String.fromCharCode(...raw.filter((c: number) => c > 0))
  }
  return String(raw).replace(/\0/g, '').trim()
}

/** 真机 MAVLink 连接：serial / udp / tcp。解析遥测 + 发送指令。 */
export class RealLink {
  private opts: ConnectOptions
  private cb: Callbacks
  private udp: Socket | null = null
  private tcp: TcpSocket | null = null
  private serial: { close: () => void; write: (b: Buffer) => void } | null = null
  private remote: { port: number; address: string } | null = null

  private splitter = new MavLinkPacketSplitter()
  private parser = new MavLinkPacketParser()
  private proto = new MavLinkProtocolV2()
  private seq = 0

  private targetSys = 1
  private targetComp = 1
  private lastHeartbeat = 0
  private emitTimer: NodeJS.Timeout | null = null
  private hbTimer: NodeJS.Timeout | null = null

  private f: TelemetryFrame = emptyFrame()
  private missionHook: ((msgid: number, d: any) => void) | null = null
  private paramHook: ((id: string, value: number, count: number, index: number) => void) | null = null

  constructor(opts: ConnectOptions, cb: Callbacks) {
    this.opts = opts
    this.cb = cb
    this.f.source = opts.kind === 'sim' ? 'sim' : opts.kind
  }

  async start(): Promise<void> {
    this.splitter.pipe(this.parser)
    this.parser.on('data', (packet: unknown) => this.onPacket(packet))
    this.parser.on('error', () => {})
    this.splitter.on('error', () => {})

    if (this.opts.kind === 'udp') await this.startUdp(this.opts.localPort)
    else if (this.opts.kind === 'tcp') await this.startTcp(this.opts.host, this.opts.port)
    else if (this.opts.kind === 'serial') await this.startSerial(this.opts.path, this.opts.baudRate)

    // 每 50ms 向渲染推送一帧（去除抖动）
    this.emitTimer = setInterval(() => {
      const connected = Date.now() - this.lastHeartbeat < 3000
      this.f.connected = connected
      this.cb.onFrame({ ...this.f, t: Date.now() })
    }, 50)

    // 每 1s 发 GCS 心跳，促使飞控串流
    this.hbTimer = setInterval(() => this.sendHeartbeat(), 1000)
    this.sendHeartbeat()
  }

  stop(): void {
    if (this.emitTimer) clearInterval(this.emitTimer)
    if (this.hbTimer) clearInterval(this.hbTimer)
    this.emitTimer = this.hbTimer = null
    try {
      this.parser.removeAllListeners()
      this.splitter.unpipe(this.parser)
    } catch {
      /* ignore */
    }
    this.udp?.close()
    this.tcp?.destroy()
    this.serial?.close()
    this.udp = this.tcp = this.serial = null
  }

  command(cmd: VehicleCommand): void {
    switch (cmd.type) {
      case 'arm':
        this.sendCommandLong(400, cmd.arm ? 1 : 0) // MAV_CMD_COMPONENT_ARM_DISARM
        break
      case 'setMode':
        this.sendCommandLong(176, 1, cmd.modeId) // DO_SET_MODE, custom enabled + modeId
        break
      case 'takeoff':
        this.sendCommandLong(22, 0, 0, 0, 0, 0, 0, cmd.alt) // NAV_TAKEOFF, param7=alt
        break
      case 'rtl':
        this.sendCommandLong(20) // NAV_RETURN_TO_LAUNCH
        break
      case 'land':
        this.sendCommandLong(21) // NAV_LAND
        break
      case 'motorTest':
        this.sendCommandLong(209, cmd.motor, 0, cmd.percent, 3) // DO_MOTOR_TEST
        break
      case 'compassCal':
        if (cmd.start) this.sendCommandLong(42424, 0, 0, 0, 0, 0, 0) // DO_START_MAG_CAL
        else this.sendCommandLong(42426) // DO_CANCEL_MAG_CAL
        break
      case 'simFly':
        break
    }
  }

  // ---- 传输层 ----
  private async startUdp(localPort: number): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const sock = createSocket('udp4')
      sock.on('message', (msg, rinfo) => {
        this.remote = { port: rinfo.port, address: rinfo.address }
        this.splitter.write(msg)
      })
      sock.on('error', (e) => {
        this.cb.onStatus({ state: 'error', kind: 'udp', message: e.message })
        reject(e)
      })
      sock.bind(localPort, () => {
        this.udp = sock
        this.cb.onStatus({ state: 'connected', kind: 'udp', detail: `监听 :${localPort}` })
        resolve()
      })
    })
  }

  private async startTcp(host: string, port: number): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const sock = new TcpSocket()
      sock.setTimeout(6000)
      sock.on('data', (d) => this.splitter.write(d))
      sock.on('error', (e) => {
        this.cb.onStatus({ state: 'error', kind: 'tcp', message: e.message })
        reject(e)
      })
      sock.on('timeout', () => sock.destroy(new Error('连接超时')))
      sock.connect(port, host, () => {
        sock.setTimeout(0)
        this.tcp = sock
        this.cb.onStatus({ state: 'connected', kind: 'tcp', detail: `${host}:${port}` })
        resolve()
      })
    })
  }

  private async startSerial(path: string, baudRate: number): Promise<void> {
    const { SerialPort } = await import('serialport')
    await new Promise<void>((resolve, reject) => {
      const port = new SerialPort({ path, baudRate }, (err) => {
        if (err) {
          this.cb.onStatus({ state: 'error', kind: 'serial', message: err.message })
          reject(err)
          return
        }
        this.serial = { close: () => port.close(), write: (b) => port.write(b) }
        this.cb.onStatus({ state: 'connected', kind: 'serial', detail: `${path} @${baudRate}` })
        resolve()
      })
      port.on('data', (d: Buffer) => this.splitter.write(d))
      port.on('error', (e: Error) =>
        this.cb.onStatus({ state: 'error', kind: 'serial', message: e.message })
      )
    })
  }

  // ---- 收包 ----
  private onPacket(packet: any): void {
    try {
      const msgid: number = packet.header.msgid
      const Clazz = REGISTRY[msgid]
      if (!Clazz) return
      const d: any = packet.protocol.data(packet.payload, Clazz)
      const f = this.f

      if (this.missionHook && MISSION_IDS.has(msgid)) {
        this.missionHook(msgid, d)
        return
      }

      if (msgid === common.ParamValue.MSG_ID) {
        if (this.paramHook) this.paramHook(normParamId(d.paramId), d.paramValue, d.paramCount, d.paramIndex)
        return
      }
      // 罗盘校准进度 / 结果 (191=MAG_CAL_PROGRESS, 192=MAG_CAL_REPORT)
      if (msgid === 191) {
        this.cb.onCalProgress({ kind: 'compass', percent: d.completionPct ?? 0, done: false, success: false })
        return
      }
      if (msgid === 192) {
        const ok = (d.calStatus ?? 0) >= 4 // MAG_CAL_SUCCESS
        this.cb.onCalProgress({ kind: 'compass', percent: 100, done: true, success: ok, message: ok ? '校准成功' : '校准失败' })
        return
      }

      switch (msgid) {
        case minimal.Heartbeat.MSG_ID: {
          this.lastHeartbeat = Date.now()
          this.targetSys = packet.header.sysid || 1
          this.targetComp = packet.header.compid || 1
          f.armed = (d.baseMode & ARMED_FLAG) !== 0
          f.mode = modeById(d.customMode)
          break
        }
        case common.Attitude.MSG_ID:
          f.roll = d.roll
          f.pitch = d.pitch
          f.yaw = (d.yaw + Math.PI * 2) % (Math.PI * 2)
          break
        case common.GlobalPositionInt.MSG_ID:
          f.lat = d.lat / 1e7
          f.lon = d.lon / 1e7
          f.relAlt = d.relativeAlt / 1000
          f.amsl = d.alt / 1000
          f.vx = d.vx / 100
          f.vy = d.vy / 100
          f.vz = -d.vz / 100
          f.gpsYaw = (d.hdg / 100) * (Math.PI / 180)
          if (f.home) f.distanceToHome = haversine(f.lat, f.lon, f.home.lat, f.home.lon)
          break
        case common.VfrHud.MSG_ID:
          f.groundSpeed = d.groundspeed
          f.climb = d.climb
          f.throttle = d.throttle
          break
        case common.SysStatus.MSG_ID:
          f.voltage = d.voltageBattery / 1000
          f.current = d.currentBattery / 100
          f.batteryRemaining = d.batteryRemaining
          break
        case common.GpsRawInt.MSG_ID:
          f.gpsFix = gpsFix(d.fixType)
          f.satellites = d.satellitesVisible
          f.hdop = d.eph / 100
          break
        case common.Vibration.MSG_ID:
          f.vibration = { x: d.vibrationX, y: d.vibrationY, z: d.vibrationZ }
          break
        case common.ServoOutputRaw.MSG_ID:
          f.motors = [
            d.servo1Raw, d.servo2Raw, d.servo3Raw, d.servo4Raw,
            d.servo5Raw, d.servo6Raw, d.servo7Raw, d.servo8Raw
          ].map((us: number) => Math.max(0, Math.min(100, (us - 1000) / 10)))
          break
        case common.RcChannels.MSG_ID:
          f.rc = [d.chan1Raw, d.chan2Raw, d.chan3Raw, d.chan4Raw, d.chan5Raw, d.chan6Raw]
          break
        case common.HomePosition.MSG_ID:
          f.home = { lat: d.latitude / 1e7, lon: d.longitude / 1e7, alt: d.altitude / 1000 }
          break
      }
    } catch {
      /* 忽略单包解析错误 */
    }
  }

  // ---- 发包 ----
  private writeRaw(buf: Buffer): void {
    if (this.udp && this.remote) this.udp.send(buf, this.remote.port, this.remote.address)
    else if (this.tcp) this.tcp.write(buf)
    else if (this.serial) this.serial.write(buf)
  }

  private send(msg: MavLinkData): void {
    try {
      const buf = this.proto.serialize(msg, this.seq++ & 0xff)
      this.writeRaw(buf)
    } catch {
      /* ignore */
    }
  }

  // ---- MISSION 上传/下载 ----
  /** 借鉴 QGC/ArduPilot：转弯模式 → 命令 + 到点半径。悬停转弯=到点几乎停下；协调转弯=较大半径掠过不停顿；
   *  自适应协调转弯=样条航点，飞控在点间走平滑曲线。 */
  private static turnToCmd(turnMode: Waypoint['turnMode']): { command: number; radius: number } {
    if (turnMode === 'adaptive') return { command: 82, radius: 8 } // NAV_SPLINE_WAYPOINT
    if (turnMode === 'coordinated') return { command: 16, radius: 8 } // NAV_WAYPOINT，大半径掠过
    return { command: 16, radius: 1 } // NAV_WAYPOINT，小半径需飞近才算到点
  }

  /** MAVLink DO_JUMP 没有标准化的"无限"哨兵值，用一个足够大的重复次数近似训练场景下的无限循环。 */
  private static readonly INFINITE_LOOP_REPEATS = 999999

  /** 组装 MISSION_ITEM_INT 序列：item0=home，其后为航点，末尾按循环/完成动作追加。 */
  private buildItems(wps: Waypoint[], opts: MissionUploadOptions): common.MissionItemInt[] {
    const home = this.f.home ?? { lat: wps[0]?.lat ?? 0, lon: wps[0]?.lon ?? 0, alt: 0 }
    const items: common.MissionItemInt[] = []
    const mk = (
      seq: number,
      command: number,
      lat: number,
      lon: number,
      alt: number,
      p1 = 0,
      p2 = 2
    ): common.MissionItemInt => {
      const it = new common.MissionItemInt()
      it.targetSystem = this.targetSys
      it.targetComponent = this.targetComp
      it.seq = seq
      it.frame = common.MavFrame.GLOBAL_RELATIVE_ALT_INT
      it.command = command
      it.current = seq === 0 ? 1 : 0
      it.autocontinue = 1
      it.param1 = p1
      it.param2 = p2
      it.param3 = 0
      it.param4 = 0
      it.x = Math.round(lat * 1e7)
      it.y = Math.round(lon * 1e7)
      it.z = alt
      it.missionType = 0
      return it
    }
    items.push(mk(0, 16, home.lat, home.lon, 0)) // home
    const firstWpSeq = 1
    wps.forEach((w, i) => {
      const { command, radius } = RealLink.turnToCmd(w.turnMode)
      items.push(mk(i + 1, command, w.lat, w.lon, w.alt, w.hoverTime, radius))
    })
    if (opts.closed && wps.length > 0) {
      const w0 = wps[0]
      const { command, radius } = RealLink.turnToCmd(w0.turnMode)
      items.push(mk(items.length, command, w0.lat, w0.lon, w0.alt, 0, radius))
    }
    if (wps.length > 0 && (opts.infiniteLoop || opts.loopCount > 1)) {
      const repeats = opts.infiniteLoop ? RealLink.INFINITE_LOOP_REPEATS : opts.loopCount - 1
      const jump = mk(items.length, 177, 0, 0, 0) // DO_JUMP
      jump.param1 = firstWpSeq
      jump.param2 = repeats
      items.push(jump)
    }
    if (opts.finishAction === 'rtl') items.push(mk(items.length, 20, 0, 0, 0)) // RETURN_TO_LAUNCH
    else if (opts.finishAction === 'land' && wps.length > 0) {
      const wl = wps[wps.length - 1]
      items.push(mk(items.length, 21, wl.lat, wl.lon, 0)) // LAND
    } else if (opts.finishAction === 'hoverHome') {
      items.push(mk(items.length, 17, home.lat, home.lon, opts.returnAlt)) // NAV_LOITER_UNLIM 原地悬停
    }
    return items
  }

  uploadMission(
    wps: Waypoint[],
    opts: MissionUploadOptions,
    onProgress: (p: MissionProgress) => void
  ): Promise<MissionProgress> {
    return new Promise((resolve) => {
      const items = this.buildItems(wps, opts)
      const total = items.length
      let sent = 0
      let timer: NodeJS.Timeout
      const finish = (error?: string): void => {
        clearTimeout(timer)
        this.missionHook = null
        const p: MissionProgress = { phase: 'upload', current: sent, total, done: true, error }
        onProgress(p)
        resolve(p)
      }
      const arm = (): void => {
        clearTimeout(timer)
        timer = setTimeout(() => finish('上传超时（未收到飞控请求）'), 5000)
      }
      this.missionHook = (msgid, d) => {
        if (msgid === common.MissionRequest.MSG_ID || msgid === common.MissionRequestInt.MSG_ID) {
          const seq: number = d.seq
          if (items[seq]) this.send(items[seq])
          sent = seq + 1
          onProgress({ phase: 'upload', current: sent, total, done: false })
          arm()
        } else if (msgid === common.MissionAck.MSG_ID) {
          finish(d.type === 0 ? undefined : `飞控拒绝（code ${d.type}）`)
        }
      }
      const count = new common.MissionCount()
      count.targetSystem = this.targetSys
      count.targetComponent = this.targetComp
      count.count = total
      count.missionType = 0
      this.send(count)
      arm()
    })
  }

  downloadMission(): Promise<Waypoint[]> {
    return new Promise((resolve) => {
      const items: any[] = []
      let count = 0
      let timer: NodeJS.Timeout
      const convert = (): Waypoint[] => {
        const out: Waypoint[] = []
        items.forEach((it) => {
          if (!it || it.seq === 0) return
          if (it.command !== 16 && it.command !== 82) return // 只还原 NAV_WAYPOINT / NAV_SPLINE_WAYPOINT
          const turnMode: Waypoint['turnMode'] = it.command === 82 ? 'adaptive' : it.param2 >= 5 ? 'coordinated' : 'stop'
          out.push({
            seq: out.length + 1,
            lat: it.x / 1e7,
            lon: it.y / 1e7,
            alt: it.z,
            speed: 8,
            turnMode,
            hoverTime: it.param1 || 0,
            heading: 0
          })
        })
        return out
      }
      const done = (): void => {
        clearTimeout(timer)
        this.missionHook = null
        resolve(convert())
      }
      const reqItem = (seq: number): void => {
        const r = new common.MissionRequestInt()
        r.targetSystem = this.targetSys
        r.targetComponent = this.targetComp
        r.seq = seq
        r.missionType = 0
        this.send(r)
      }
      const sendAck = (): void => {
        const a = new common.MissionAck()
        a.targetSystem = this.targetSys
        a.targetComponent = this.targetComp
        a.type = 0
        a.missionType = 0
        this.send(a)
      }
      const arm = (): void => {
        clearTimeout(timer)
        timer = setTimeout(done, 5000)
      }
      this.missionHook = (msgid, d) => {
        if (msgid === common.MissionCount.MSG_ID) {
          count = d.count
          if (count === 0) {
            sendAck()
            done()
            return
          }
          reqItem(0)
          arm()
        } else if (msgid === common.MissionItemInt.MSG_ID) {
          items[d.seq] = d
          if (d.seq >= count - 1) {
            sendAck()
            done()
          } else {
            reqItem(d.seq + 1)
            arm()
          }
        }
      }
      const list = new common.MissionRequestList()
      list.targetSystem = this.targetSys
      list.targetComponent = this.targetComp
      list.missionType = 0
      this.send(list)
      arm()
    })
  }

  // ---- 参数读写 ----
  refreshParams(onProgress: (p: ParamLoadProgress) => void): Promise<ParamEntry[]> {
    return new Promise((resolve) => {
      const map = new Map<string, ParamEntry>()
      let count = 0
      let timer: NodeJS.Timeout
      const done = (): void => {
        clearTimeout(timer)
        this.paramHook = null
        onProgress({ received: map.size, total: count || map.size, done: true })
        resolve([...map.values()])
      }
      const arm = (): void => {
        clearTimeout(timer)
        timer = setTimeout(done, 2500) // 空闲即认为结束
      }
      this.paramHook = (id, value, total) => {
        count = total
        if (id) map.set(id, { id, value, type: 9 })
        onProgress({ received: map.size, total, done: false })
        if (count > 0 && map.size >= count) done()
        else arm()
      }
      const req = new common.ParamRequestList()
      req.targetSystem = this.targetSys
      req.targetComponent = this.targetComp
      this.send(req)
      arm()
    })
  }

  setParam(id: string, value: number): Promise<number> {
    return new Promise((resolve) => {
      let timer: NodeJS.Timeout
      const prevHook = this.paramHook
      const finish = (v: number): void => {
        clearTimeout(timer)
        this.paramHook = prevHook
        resolve(v)
      }
      this.paramHook = (pid, pval, count, index) => {
        if (pid === id) finish(pval)
        else if (prevHook) prevHook(pid, pval, count, index)
      }
      const set = new common.ParamSet()
      set.targetSystem = this.targetSys
      set.targetComponent = this.targetComp
      set.paramId = id
      set.paramValue = value
      set.paramType = 9 // REAL32
      this.send(set)
      timer = setTimeout(() => finish(value), 2000)
    })
  }

  private sendHeartbeat(): void {
    const hb = new minimal.Heartbeat()
    hb.type = minimal.MavType.GCS
    hb.autopilot = minimal.MavAutopilot.INVALID
    hb.baseMode = 0 as minimal.MavModeFlag
    hb.customMode = 0
    hb.systemStatus = minimal.MavState.ACTIVE
    this.send(hb)
  }

  private sendCommandLong(
    command: number,
    p1 = 0, p2 = 0, p3 = 0, p4 = 0, p5 = 0, p6 = 0, p7 = 0
  ): void {
    const c = new common.CommandLong()
    c.targetSystem = this.targetSys
    c.targetComponent = this.targetComp
    c.command = command
    c.confirmation = 0
    c.param1 = p1; c.param2 = p2; c.param3 = p3; c.param4 = p4
    c.param5 = p5; c.param6 = p6; c.param7 = p7
    this.send(c)
  }
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}
