import { create } from 'zustand'
import { flushSync } from 'react-dom'
import { withViewTransition } from '../util/motion'

export type Route =
  | 'home'
  | 'manual'
  | 'mission'
  | 'wizard'
  | 'caac'
  | 'tuning'
  | 'sim'

export type MapStyleId = 'esri-sat' | 'osm'

interface UiState {
  route: Route
  go: (r: Route) => void
  connectOpen: boolean
  openConnect: () => void
  closeConnect: () => void
  settingsOpen: boolean
  setSettingsOpen: (v: boolean) => void
  mapStyle: MapStyleId
  setMapStyle: (m: MapStyleId) => void
  follow: boolean
  toggleFollow: () => void
}

export const useUi = create<UiState>((set) => ({
  route: 'home',
  // View Transitions 需要在回调内同步完成 DOM 更新才能截到新旧两帧，
  // 故用 flushSync 强制 React 立即提交这次路由切换。
  go: (r) =>
    withViewTransition(() => {
      flushSync(() => set({ route: r }))
    }),
  connectOpen: false,
  openConnect: () => set({ connectOpen: true }),
  closeConnect: () => set({ connectOpen: false }),
  settingsOpen: false,
  setSettingsOpen: (v) => set({ settingsOpen: v }),
  mapStyle: 'esri-sat',
  setMapStyle: (m) => set({ mapStyle: m }),
  follow: true,
  toggleFollow: () => set((s) => ({ follow: !s.follow }))
}))
