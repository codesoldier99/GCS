import { EventEmitter } from 'node:events'
import type {
  CalProgress,
  ConnectOptions,
  LinkStatus,
  MissionProgress,
  MissionUploadOptions,
  ParamEntry,
  ParamLoadProgress,
  SerialPortInfo,
  VehicleCommand
} from '../../shared/protocol'
import type { TelemetryFrame } from '../../shared/telemetry'
import type { Waypoint } from '../../shared/mission'
import { Simulator } from './Simulator'
import { RealLink } from './RealLink'

type Events = {
  telemetry: (f: TelemetryFrame) => void
  status: (s: LinkStatus) => void
  missionProgress: (p: MissionProgress) => void
  paramProgress: (p: ParamLoadProgress) => void
  calProgress: (p: CalProgress) => void
}

export class LinkManager extends EventEmitter {
  private sim: Simulator | null = null
  private real: RealLink | null = null
  private status: LinkStatus = { state: 'disconnected' }

  on<E extends keyof Events>(e: E, l: Events[E]): this {
    return super.on(e, l as (...a: unknown[]) => void)
  }
  private emitTelemetry(f: TelemetryFrame): void {
    this.emit('telemetry', f)
  }
  private setStatus(s: LinkStatus): void {
    this.status = s
    this.emit('status', s)
  }

  async listSerialPorts(): Promise<SerialPortInfo[]> {
    try {
      const { SerialPort } = await import('serialport')
      const ports = await SerialPort.list()
      return ports.map((p) => ({ path: p.path, manufacturer: p.manufacturer }))
    } catch {
      return []
    }
  }

  async connect(opts: ConnectOptions): Promise<LinkStatus> {
    this.disconnect()
    this.setStatus({ state: 'connecting', kind: opts.kind })

    if (opts.kind === 'sim') {
      this.sim = new Simulator((f) => this.emitTelemetry(f))
      this.sim.onCalProgress = (p) => this.emit('calProgress', p)
      this.sim.start()
      this.setStatus({ state: 'connected', kind: 'sim', detail: '内置仿真' })
      return this.status
    }

    try {
      this.real = new RealLink(opts, {
        onFrame: (f) => this.emitTelemetry(f),
        onStatus: (s) => this.setStatus(s),
        onCalProgress: (p) => this.emit('calProgress', p)
      })
      await this.real.start()
      return this.status
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.setStatus({ state: 'error', kind: opts.kind, message })
      this.real = null
      return this.status
    }
  }

  disconnect(): void {
    this.sim?.stop()
    this.sim = null
    this.real?.stop()
    this.real = null
    if (this.status.state !== 'disconnected') {
      this.setStatus({ state: 'disconnected' })
    }
  }

  command(cmd: VehicleCommand): void {
    this.sim?.command(cmd)
    this.real?.command(cmd)
  }

  async uploadMission(wps: Waypoint[], opts: MissionUploadOptions): Promise<MissionProgress> {
    const onProgress = (p: MissionProgress): void => {
      this.emit('missionProgress', p)
    }
    if (this.sim) return this.sim.uploadMission(wps, opts, onProgress)
    if (this.real) return this.real.uploadMission(wps, opts, onProgress)
    return { phase: 'upload', current: 0, total: wps.length, done: false, error: '未连接' }
  }

  async downloadMission(): Promise<Waypoint[]> {
    if (this.sim) return this.sim.downloadMission()
    if (this.real) return this.real.downloadMission()
    return []
  }

  async refreshParams(): Promise<ParamEntry[]> {
    const onProgress = (p: ParamLoadProgress): void => {
      this.emit('paramProgress', p)
    }
    if (this.sim) return this.sim.refreshParams(onProgress)
    if (this.real) return this.real.refreshParams(onProgress)
    return []
  }

  async setParam(id: string, value: number): Promise<number> {
    if (this.sim) return this.sim.setParam(id, value)
    if (this.real) return this.real.setParam(id, value)
    return value
  }
}
