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

export type MapStyleId = 'esri-sat' | 'osm' | 'amap-sat' | 'amap-vec' | 'tencent' | 'tianditu'

export interface MapProviderMeta {
  id: MapStyleId
  label: string
  /** 该底图瓦片使用的坐标系：wgs84（国际通用）或 gcj02（国内厂商法定加偏坐标系）。
   *  渲染/取点时要不要做 WGS84↔GCJ02 转换全看这个字段，见 util/coordTransform.ts。 */
  datum: 'wgs84' | 'gcj02'
  /** 天地图等需要开发者 Key 才能用的底图：没配置 Key 时在切换列表里跳过。 */
  requiresKey?: boolean
}

/** 参考 Mission Planner：内置多家底图供选择，国内厂商底图默认按 GCJ02 处理加偏。 */
export const MAP_PROVIDERS: MapProviderMeta[] = [
  { id: 'esri-sat', label: 'Esri 卫星图', datum: 'wgs84' },
  { id: 'osm', label: 'OSM 街道图', datum: 'wgs84' },
  { id: 'amap-sat', label: '高德卫星图', datum: 'gcj02' },
  { id: 'amap-vec', label: '高德街道图', datum: 'gcj02' },
  { id: 'tencent', label: '腾讯地图', datum: 'gcj02' },
  { id: 'tianditu', label: '天地图（需配置 Key）', datum: 'gcj02', requiresKey: true }
]

export function mapProviderMeta(id: MapStyleId): MapProviderMeta {
  return MAP_PROVIDERS.find((p) => p.id === id) ?? MAP_PROVIDERS[0]
}

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
  /** 依次切换到下一个可用底图（自动跳过未配置 Key 的天地图）。 */
  cycleMapProvider: () => void
  /** 天地图矢量/影像服务需要的开发者 Key（用户自备，本地持久化，不随代码提交）。 */
  tiandituKey: string
  setTiandituKey: (k: string) => void
  follow: boolean
  toggleFollow: () => void
}

const TDT_KEY_STORAGE = 'zy-gcs-tianditu-key'

function loadTiandituKey(): string {
  try {
    return localStorage.getItem(TDT_KEY_STORAGE) ?? ''
  } catch {
    return ''
  }
}

export const useUi = create<UiState>((set, get) => ({
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
  cycleMapProvider: () => {
    const { mapStyle, tiandituKey } = get()
    const available = MAP_PROVIDERS.filter((p) => !p.requiresKey || tiandituKey)
    const idx = available.findIndex((p) => p.id === mapStyle)
    const next = available[(idx + 1) % available.length] ?? available[0]
    set({ mapStyle: next.id })
  },
  tiandituKey: loadTiandituKey(),
  setTiandituKey: (k) => {
    set({ tiandituKey: k })
    try {
      localStorage.setItem(TDT_KEY_STORAGE, k)
    } catch {
      /* 隐私模式/配额满：不持久化也不影响当次使用 */
    }
  },
  follow: true,
  toggleFollow: () => set((s) => ({ follow: !s.follow }))
}))
