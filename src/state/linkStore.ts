import { create } from 'zustand'
import type { ConnectOptions, LinkStatus } from '@shared/protocol'
import { useVehicle } from './vehicleStore'

interface LinkState {
  status: LinkStatus
  connecting: boolean
  setStatus: (s: LinkStatus) => void
  connect: (opts: ConnectOptions) => Promise<void>
  disconnect: () => Promise<void>
}

export const useLink = create<LinkState>((set) => ({
  status: { state: 'disconnected' },
  connecting: false,
  setStatus: (s) => set({ status: s, connecting: s.state === 'connecting' }),
  connect: async (opts) => {
    set({ connecting: true })
    useVehicle.getState().reset()
    const status = await window.gcs.connect(opts)
    set({ status, connecting: status.state === 'connecting' })
  },
  disconnect: async () => {
    await window.gcs.disconnect()
    set({ status: { state: 'disconnected' }, connecting: false })
  }
}))

/** 应用启动时挂载 IPC 监听（在 App 里调用一次）。 */
export function wireTelemetry(): () => void {
  const offT = window.gcs.onTelemetry((f) => useVehicle.getState().setFrame(f))
  const offS = window.gcs.onStatus((s) => useLink.getState().setStatus(s))
  return () => {
    offT()
    offS()
  }
}

export function isConnected(s: LinkStatus): boolean {
  return s.state === 'connected'
}
