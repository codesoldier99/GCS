import { BrowserWindow, ipcMain } from 'electron'
import { IPC } from '../shared/protocol'
import type { ConnectOptions, MissionUploadOptions, VehicleCommand } from '../shared/protocol'
import type { Waypoint } from '../shared/mission'
import type { LinkManager } from './link/LinkManager'

export function registerIpc(getWin: () => BrowserWindow | null, link: LinkManager): void {
  // 已关闭/已销毁的窗口不能再 send，否则抛 "Object has been destroyed"
  const sendSafe = (channel: string, payload: unknown): void => {
    const win = getWin()
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
  }

  // 遥测/状态 → 转发给渲染
  link.on('telemetry', (frame) => sendSafe(IPC.telemetry, frame))
  link.on('status', (status) => sendSafe(IPC.status, status))
  link.on('missionProgress', (p) => sendSafe(IPC.missionProgress, p))
  link.on('paramProgress', (p) => sendSafe(IPC.paramProgress, p))
  link.on('calProgress', (p) => sendSafe(IPC.calProgress, p))

  ipcMain.handle(IPC.listSerialPorts, () => link.listSerialPorts())
  ipcMain.handle(IPC.connect, (_e, opts: ConnectOptions) => link.connect(opts))
  ipcMain.handle(IPC.disconnect, () => link.disconnect())
  ipcMain.handle(IPC.command, (_e, cmd: VehicleCommand) => link.command(cmd))
  ipcMain.handle(IPC.missionUpload, (_e, wps: Waypoint[], opts: MissionUploadOptions) =>
    link.uploadMission(wps, opts)
  )
  ipcMain.handle(IPC.missionDownload, () => link.downloadMission())
  ipcMain.handle(IPC.paramRefresh, () => link.refreshParams())
  ipcMain.handle(IPC.paramSet, (_e, id: string, value: number) => link.setParam(id, value))

  ipcMain.on(IPC.winMinimize, () => {
    const w = getWin()
    if (w && !w.isDestroyed()) w.minimize()
  })
  ipcMain.on(IPC.winMaximize, () => {
    const w = getWin()
    if (!w || w.isDestroyed()) return
    w.isMaximized() ? w.unmaximize() : w.maximize()
  })
  ipcMain.on(IPC.winClose, () => {
    const w = getWin()
    if (w && !w.isDestroyed()) w.close()
  })
}
