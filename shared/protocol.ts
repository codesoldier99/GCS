// IPC 通道契约（主↔渲染）。preload 只暴露这里定义的 API。

import type { LinkKind } from './telemetry'
import type { Waypoint } from './mission'

export interface SerialOptions {
  kind: 'serial'
  path: string
  baudRate: number
}
export interface UdpOptions {
  kind: 'udp'
  localPort: number
}
export interface TcpOptions {
  kind: 'tcp'
  host: string
  port: number
}
export interface SimOptions {
  kind: 'sim'
}
export type ConnectOptions = SerialOptions | UdpOptions | TcpOptions | SimOptions

export type LinkStatus =
  | { state: 'disconnected' }
  | { state: 'connecting'; kind: LinkKind }
  | { state: 'connected'; kind: LinkKind; detail?: string }
  | { state: 'error'; kind: LinkKind; message: string }

export interface SerialPortInfo {
  path: string
  manufacturer?: string
}

/** 渲染 → 主进程 的指令 */
export type VehicleCommand =
  | { type: 'arm'; arm: boolean }
  | { type: 'setMode'; modeId: number }
  | { type: 'takeoff'; alt: number }
  | { type: 'rtl' }
  | { type: 'land' }
  | { type: 'motorTest'; motor: number; percent: number }
  | { type: 'compassCal'; start: boolean }
  | { type: 'simFly'; enable: boolean } // 仿真：一键起飞绕圈演示
  | {
      type: 'simFigure8'
      enable: boolean
      a: { lat: number; lon: number }
      b: { lat: number; lon: number }
      alt: number
    } // 仿真：绕八字演示

export interface ParamEntry {
  id: string
  value: number
  type: number
}

export interface ParamLoadProgress {
  received: number
  total: number
  done: boolean
}

export interface CalProgress {
  kind: 'compass'
  percent: number
  done: boolean
  success: boolean
  message?: string
}

/** IPC 通道名 */
export const IPC = {
  listSerialPorts: 'link:listSerialPorts',
  connect: 'link:connect',
  disconnect: 'link:disconnect',
  status: 'link:status', // 主→渲染 事件
  telemetry: 'telemetry:frame', // 主→渲染 事件
  command: 'vehicle:command',
  missionUpload: 'mission:upload',
  missionDownload: 'mission:download',
  missionProgress: 'mission:progress', // 主→渲染 事件
  paramRefresh: 'param:refresh',
  paramSet: 'param:set',
  paramProgress: 'param:progress', // 主→渲染 事件
  calProgress: 'cal:progress', // 主→渲染 事件
  // 窗口控制
  winMinimize: 'win:minimize',
  winMaximize: 'win:maximize',
  winClose: 'win:close'
} as const

export interface MissionProgress {
  phase: 'upload' | 'download'
  current: number
  total: number
  done: boolean
  error?: string
}

export interface MissionUploadOptions {
  finishAction: 'hover' | 'rtl' | 'land' | 'hoverHome'
  closed: boolean
  returnAlt: number
  loopCount: number
  infiniteLoop: boolean
  /** 已在渲染侧解析好的返航点坐标；null 表示使用飞控自身记录的 HOME_POSITION。 */
  returnLat: number | null
  returnLon: number | null
}

/** window.gcs 的类型（preload 暴露） */
export interface GcsBridge {
  listSerialPorts(): Promise<SerialPortInfo[]>
  connect(opts: ConnectOptions): Promise<LinkStatus>
  disconnect(): Promise<void>
  command(cmd: VehicleCommand): Promise<void>
  uploadMission(waypoints: Waypoint[], opts: MissionUploadOptions): Promise<MissionProgress>
  downloadMission(): Promise<Waypoint[]>
  refreshParams(): Promise<ParamEntry[]>
  setParam(id: string, value: number): Promise<number>
  onTelemetry(cb: (frame: import('./telemetry').TelemetryFrame) => void): () => void
  onStatus(cb: (status: LinkStatus) => void): () => void
  onMissionProgress(cb: (p: MissionProgress) => void): () => void
  onParamProgress(cb: (p: ParamLoadProgress) => void): () => void
  onCalProgress(cb: (p: CalProgress) => void): () => void
  win: {
    minimize(): void
    maximize(): void
    close(): void
  }
}
