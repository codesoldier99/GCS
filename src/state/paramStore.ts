import { create } from 'zustand'
import type { ParamLoadProgress } from '@shared/protocol'

interface ParamState {
  params: Record<string, number>
  loaded: boolean
  loading: boolean
  progress: ParamLoadProgress | null
  load: () => Promise<void>
  setParam: (id: string, value: number) => Promise<void>
  setMany: (entries: [string, number][]) => Promise<void>
  get: (id: string, fallback?: number) => number
}

export const useParams = create<ParamState>((set, get) => ({
  params: {},
  loaded: false,
  loading: false,
  progress: null,
  load: async () => {
    if (get().loading) return
    set({ loading: true, progress: null })
    const off = window.gcs.onParamProgress((p) => set({ progress: p }))
    try {
      const list = await window.gcs.refreshParams()
      const map: Record<string, number> = {}
      list.forEach((p) => (map[p.id] = p.value))
      set({ params: map, loaded: true })
    } finally {
      off()
      set({ loading: false })
    }
  },
  setParam: async (id, value) => {
    const confirmed = await window.gcs.setParam(id, value)
    set((s) => ({ params: { ...s.params, [id]: confirmed } }))
  },
  setMany: async (entries) => {
    for (const [id, value] of entries) {
      const confirmed = await window.gcs.setParam(id, value)
      set((s) => ({ params: { ...s.params, [id]: confirmed } }))
    }
  },
  get: (id, fallback = 0) => {
    const v = get().params[id]
    return v === undefined ? fallback : v
  }
}))
