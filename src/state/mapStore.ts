import { create } from 'zustand'
import type { Map as MlMap } from 'maplibre-gl'
import type { LL } from '../util/geo'

interface MapState {
  map: MlMap | null
  ready: boolean
  setMap: (m: MlMap | null) => void

  /** 测距工具 */
  measureMode: boolean
  measurePoints: LL[]
  toggleMeasure: () => void
  addMeasurePoint: (p: LL) => void
  clearMeasure: () => void
}

/** 共享 MapLibre 实例，供航线图层等叠加使用。 */
export const useMapStore = create<MapState>((set, get) => ({
  map: null,
  ready: false,
  setMap: (m) => set({ map: m, ready: !!m }),

  measureMode: false,
  measurePoints: [],
  toggleMeasure: () => {
    const on = !get().measureMode
    set({ measureMode: on, measurePoints: on ? [] : get().measurePoints })
  },
  addMeasurePoint: (p) => set({ measurePoints: [...get().measurePoints, p] }),
  clearMeasure: () => set({ measureMode: false, measurePoints: [] })
}))
