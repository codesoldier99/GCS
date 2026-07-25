import { create } from 'zustand'

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
  mapStyle: MapStyleId
  setMapStyle: (m: MapStyleId) => void
  follow: boolean
  toggleFollow: () => void
}

export const useUi = create<UiState>((set) => ({
  route: 'home',
  go: (r) => set({ route: r }),
  connectOpen: false,
  openConnect: () => set({ connectOpen: true }),
  closeConnect: () => set({ connectOpen: false }),
  mapStyle: 'esri-sat',
  setMapStyle: (m) => set({ mapStyle: m }),
  follow: true,
  toggleFollow: () => set((s) => ({ follow: !s.follow }))
}))
