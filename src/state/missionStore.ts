import { create } from 'zustand'
import { emptyMission, type Mission, type Waypoint } from '@shared/mission'
import { rotateAround, offsetNE, type LL } from '../util/geo'

type ToolDialog = 'none' | 'relcoord' | 'transform' | 'template' | 'list'

interface MissionState {
  mission: Mission
  selected: number | null // 选中航点 seq
  addMode: boolean
  dialog: ToolDialog
  past: Mission[]
  future: Mission[]

  /** 手动起飞点（未连接飞控时的规划基准；已连接时以遥测 HOME_POSITION 为准，见 util/effectiveHome.ts） */
  homeOverride: LL | null
  setHomeMode: boolean
  setHomeOverride: (ll: LL | null) => void
  toggleSetHomeMode: (v?: boolean) => void

  /** 打开相对坐标编辑器时预选的基准点（由航点右键菜单"以此点为基准"触发） */
  pendingBase: string | null
  setPendingBase: (v: string | null) => void

  select: (seq: number | null) => void
  setAddMode: (v: boolean) => void
  openDialog: (d: ToolDialog) => void

  addWaypoint: (lat: number, lon: number) => void
  insertAfter: (seq: number) => void
  moveWaypoint: (seq: number, lat: number, lon: number) => void
  updateWaypoint: (seq: number, patch: Partial<Waypoint>) => void
  deleteWaypoint: (seq: number) => void
  clearAll: () => void
  reorder: (from: number, to: number) => void
  reverse: () => void

  applyToAll: (patch: Partial<Waypoint>) => void
  setMission: (patch: Partial<Mission>) => void
  replaceWaypoints: (wps: Waypoint[], mode: 'replace' | 'append') => void

  rotate: (base: LL, angleDeg: number) => void
  translate: (north: number, east: number) => void

  loadMission: (m: Mission) => void
  undo: () => void
  redo: () => void
}

function clone(m: Mission): Mission {
  return JSON.parse(JSON.stringify(m))
}

function renumber(wps: Waypoint[]): Waypoint[] {
  return wps.map((w, i) => ({ ...w, seq: i + 1 }))
}

function defWaypoint(m: Mission, lat: number, lon: number): Waypoint {
  const last = m.waypoints[m.waypoints.length - 1]
  return {
    seq: m.waypoints.length + 1,
    lat,
    lon,
    alt: last?.alt ?? 30,
    speed: last?.speed ?? m.startSpeed,
    turnMode: last?.turnMode ?? 'stop',
    hoverTime: last?.hoverTime ?? 0,
    heading: 0
  }
}

export const useMission = create<MissionState>((set, get) => {
  /** 提交一次可撤销的变更 */
  const commit = (mutate: (m: Mission) => Mission): void => {
    const cur = get().mission
    const next = mutate(clone(cur))
    set({ mission: next, past: [...get().past, cur].slice(-50), future: [] })
  }

  return {
    mission: emptyMission(),
    selected: null,
    addMode: false,
    dialog: 'none',
    past: [],
    future: [],

    homeOverride: null,
    setHomeMode: false,
    setHomeOverride: (ll) => set({ homeOverride: ll, setHomeMode: false }),
    toggleSetHomeMode: (v) => set((s) => ({ setHomeMode: v ?? !s.setHomeMode, addMode: false })),

    pendingBase: null,
    setPendingBase: (v) => set({ pendingBase: v }),

    select: (seq) => set({ selected: seq }),
    setAddMode: (v) => set({ addMode: v, setHomeMode: false }),
    openDialog: (d) => set({ dialog: d }),

    addWaypoint: (lat, lon) =>
      commit((m) => {
        m.waypoints.push(defWaypoint(m, lat, lon))
        return m
      }),

    insertAfter: (seq) =>
      commit((m) => {
        const idx = m.waypoints.findIndex((w) => w.seq === seq)
        const base = m.waypoints[idx]
        if (!base) return m
        const p = offsetNE({ lat: base.lat, lon: base.lon }, 10, 0)
        const wp: Waypoint = { ...base, lat: p.lat, lon: p.lon, seq: 0 }
        m.waypoints.splice(idx + 1, 0, wp)
        m.waypoints = renumber(m.waypoints)
        return m
      }),

    moveWaypoint: (seq, lat, lon) =>
      commit((m) => {
        const w = m.waypoints.find((x) => x.seq === seq)
        if (w) {
          w.lat = lat
          w.lon = lon
        }
        return m
      }),

    updateWaypoint: (seq, patch) =>
      commit((m) => {
        const i = m.waypoints.findIndex((x) => x.seq === seq)
        if (i >= 0) m.waypoints[i] = { ...m.waypoints[i], ...patch }
        return m
      }),

    deleteWaypoint: (seq) => {
      commit((m) => {
        m.waypoints = renumber(m.waypoints.filter((x) => x.seq !== seq))
        return m
      })
      const sel = get().selected
      if (sel === seq) set({ selected: null })
    },

    clearAll: () => {
      commit((m) => {
        m.waypoints = []
        return m
      })
      set({ selected: null, addMode: false })
    },

    reorder: (from, to) =>
      commit((m) => {
        const arr = m.waypoints
        const [moved] = arr.splice(from, 1)
        arr.splice(to, 0, moved)
        m.waypoints = renumber(arr)
        return m
      }),

    reverse: () =>
      commit((m) => {
        m.waypoints = renumber([...m.waypoints].reverse())
        return m
      }),

    applyToAll: (patch) =>
      commit((m) => {
        m.waypoints = m.waypoints.map((w) => ({ ...w, ...patch }))
        return m
      }),

    setMission: (patch) =>
      commit((m) => Object.assign(m, patch)),

    replaceWaypoints: (wps, mode) =>
      commit((m) => {
        m.waypoints = renumber(mode === 'replace' ? wps : [...m.waypoints, ...wps])
        return m
      }),

    rotate: (base, angleDeg) =>
      commit((m) => {
        m.waypoints = m.waypoints.map((w) => {
          const p = rotateAround(base, { lat: w.lat, lon: w.lon }, angleDeg)
          return { ...w, lat: p.lat, lon: p.lon }
        })
        return m
      }),

    translate: (north, east) =>
      commit((m) => {
        m.waypoints = m.waypoints.map((w) => {
          const p = offsetNE({ lat: w.lat, lon: w.lon }, north, east)
          return { ...w, lat: p.lat, lon: p.lon }
        })
        return m
      }),

    loadMission: (m) => set({ mission: clone(m), selected: null, past: [], future: [] }),

    undo: () => {
      const { past, mission, future } = get()
      if (past.length === 0) return
      const prev = past[past.length - 1]
      set({
        mission: prev,
        past: past.slice(0, -1),
        future: [mission, ...future].slice(0, 50),
        selected: null
      })
    },

    redo: () => {
      const { future, mission, past } = get()
      if (future.length === 0) return
      const next = future[0]
      set({ mission: next, future: future.slice(1), past: [...past, mission], selected: null })
    }
  }
})
