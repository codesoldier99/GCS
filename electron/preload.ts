import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/protocol'
import type {
  CalProgress,
  ConnectOptions,
  GcsBridge,
  LinkStatus,
  MissionProgress,
  MissionUploadOptions,
  ParamEntry,
  ParamLoadProgress,
  SerialPortInfo,
  VehicleCommand
} from '../shared/protocol'
import type { TelemetryFrame } from '../shared/telemetry'
import type { Waypoint } from '../shared/mission'

const bridge: GcsBridge = {
  listSerialPorts: () => ipcRenderer.invoke(IPC.listSerialPorts) as Promise<SerialPortInfo[]>,
  connect: (opts: ConnectOptions) => ipcRenderer.invoke(IPC.connect, opts) as Promise<LinkStatus>,
  disconnect: () => ipcRenderer.invoke(IPC.disconnect) as Promise<void>,
  command: (cmd: VehicleCommand) => ipcRenderer.invoke(IPC.command, cmd) as Promise<void>,
  uploadMission: (waypoints: Waypoint[], opts: MissionUploadOptions) =>
    ipcRenderer.invoke(IPC.missionUpload, waypoints, opts) as Promise<MissionProgress>,
  downloadMission: () => ipcRenderer.invoke(IPC.missionDownload) as Promise<Waypoint[]>,
  refreshParams: () => ipcRenderer.invoke(IPC.paramRefresh) as Promise<ParamEntry[]>,
  setParam: (id: string, value: number) =>
    ipcRenderer.invoke(IPC.paramSet, id, value) as Promise<number>,
  onMissionProgress: (cb: (p: MissionProgress) => void) => {
    const listener = (_e: unknown, p: MissionProgress) => cb(p)
    ipcRenderer.on(IPC.missionProgress, listener)
    return () => ipcRenderer.removeListener(IPC.missionProgress, listener)
  },
  onParamProgress: (cb: (p: ParamLoadProgress) => void) => {
    const listener = (_e: unknown, p: ParamLoadProgress) => cb(p)
    ipcRenderer.on(IPC.paramProgress, listener)
    return () => ipcRenderer.removeListener(IPC.paramProgress, listener)
  },
  onCalProgress: (cb: (p: CalProgress) => void) => {
    const listener = (_e: unknown, p: CalProgress) => cb(p)
    ipcRenderer.on(IPC.calProgress, listener)
    return () => ipcRenderer.removeListener(IPC.calProgress, listener)
  },
  onTelemetry: (cb: (frame: TelemetryFrame) => void) => {
    const listener = (_e: unknown, frame: TelemetryFrame) => cb(frame)
    ipcRenderer.on(IPC.telemetry, listener)
    return () => ipcRenderer.removeListener(IPC.telemetry, listener)
  },
  onStatus: (cb: (status: LinkStatus) => void) => {
    const listener = (_e: unknown, status: LinkStatus) => cb(status)
    ipcRenderer.on(IPC.status, listener)
    return () => ipcRenderer.removeListener(IPC.status, listener)
  },
  win: {
    minimize: () => ipcRenderer.send(IPC.winMinimize),
    maximize: () => ipcRenderer.send(IPC.winMaximize),
    close: () => ipcRenderer.send(IPC.winClose)
  }
}

contextBridge.exposeInMainWorld('gcs', bridge)
