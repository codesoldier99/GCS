import { create } from 'zustand'
import { emptyFrame, type TelemetryFrame } from '@shared/telemetry'

interface VehicleState {
  frame: TelemetryFrame
  /** 飞行轨迹点（经纬） */
  track: [number, number][]
  /** 回放模式：忽略实时遥测，仅由回放驱动 */
  replayMode: boolean
  setReplayMode: (v: boolean) => void
  setFrame: (f: TelemetryFrame) => void
  setReplay: (f: TelemetryFrame, track: [number, number][]) => void
  clearTrack: () => void
  reset: () => void
}

let lastTrackAt = 0

export const useVehicle = create<VehicleState>((set, get) => ({
  frame: emptyFrame(),
  track: [],
  replayMode: false,
  setReplayMode: (v) => set({ replayMode: v }),
  setFrame: (f) => {
    if (get().replayMode) return // 回放中忽略实时帧
    const now = f.t
    const st = get()
    let track = st.track
    // 采样：解锁且有定位、约每 300ms 记一个点
    if (f.armed && f.gpsFix !== 'no-fix' && f.gpsFix !== 'none' && now - lastTrackAt > 300) {
      lastTrackAt = now
      track = [...st.track, [f.lon, f.lat] as [number, number]]
      if (track.length > 4000) track = track.slice(track.length - 4000)
    }
    set({ frame: f, track })
  },
  setReplay: (f, track) => set({ frame: f, track }),
  clearTrack: () => set({ track: [] }),
  reset: () => {
    lastTrackAt = 0
    set({ frame: emptyFrame(), track: [] })
  }
}))
