import { create } from 'zustand'
import type { TelemetryFrame } from '@shared/telemetry'

export interface LogSession {
  name: string
  frames: TelemetryFrame[]
}

interface LogState {
  // 录制
  recording: boolean
  buffer: TelemetryFrame[]
  toggleRecord: () => void
  record: (f: TelemetryFrame) => void
  clearBuffer: () => void

  // 回放源
  source: LogSession | null
  loadCurrent: () => void
  loadSession: (s: LogSession) => void
  exportBuffer: () => void
}

const MAX = 30000

export const useLog = create<LogState>((set, get) => ({
  recording: true,
  buffer: [],
  toggleRecord: () => set((s) => ({ recording: !s.recording })),
  record: (f) => {
    if (!get().recording) return
    // 仅记录有意义的帧（已连接）
    if (!f.connected) return
    const buf = get().buffer
    // 约 10Hz 抽样即可
    const last = buf[buf.length - 1]
    if (last && f.t - last.t < 90) return
    const next = buf.length >= MAX ? buf.slice(1) : buf.slice()
    next.push({ ...f })
    set({ buffer: next })
  },
  clearBuffer: () => set({ buffer: [] }),

  source: null,
  loadCurrent: () => {
    const buf = get().buffer
    set({ source: { name: `当前会话 (${buf.length} 帧)`, frames: buf.slice() } })
  },
  loadSession: (s) => set({ source: s }),
  exportBuffer: () => {
    const buf = get().buffer
    const blob = new Blob([JSON.stringify({ name: '中影智能会话记录', frames: buf })], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `flightlog-${buf.length}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
}))
