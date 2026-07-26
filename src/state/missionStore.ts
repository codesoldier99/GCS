import { create } from 'zustand'
import { emptyMission, type Mission, type Waypoint, type ReturnPointMode } from '@shared/mission'
import { rotateAround, offsetNE, type LL } from '../util/geo'

type ToolDialog = 'none' | 'relcoord' | 'transform' | 'template' | 'list'

/** 除普通航点(seq)外，左侧面板还可以选中"起飞点"或"返航点"进行编辑。 */
export type Selection = number | 'home' | 'return' | null

interface MissionState {
  mission: Mission
  selected: Selection
  addMode: boolean
  dialog: ToolDialog
  past: Mission[]
  future: Mission[]

  /** 手动起飞点（未连接飞控时的规划基准；已连接时以遥测 HOME_POSITION 为准，见 util/effectiveHome.ts） */
  homeOverride: LL | null
  setHomeMode: boolean
  setHomeOverride: (ll: LL | null) => void
  toggleSetHomeMode: (v?: boolean) => void

  /** 地图空白处右键"设置返航点于此"进入的落点模式 */
  setReturnMode: boolean
  toggleSetReturnMode: (v?: boolean) => void
  setReturnCustom: (ll: LL) => void
  setReturnPointMode: (mode: ReturnPointMode) => void
  setReturnWaypoint: (seq: number | null) => void

  /** 打开相对坐标编辑器时预选的基准点（由航点右键菜单"以此点为基准"触发） */
  pendingBase: string | null
  setPendingBase: (v: string | null) => void

  select: (seq: Selection) => void
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

  /** 把某个航点"替换为起飞点"：从航线中移除并成为新的起飞点。 */
  setWaypointAsHome: (seq: number) => void
  /** 把某个航点标记为返航点（保留在航线中，仅记录引用）。 */
  setWaypointAsReturn: (seq: number) => void

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

/**
 * 返航点若设为"与某航点重合"，记录的是该航点的 seq；但删除/反序/拖拽排序都会让 seq 重新编号，
 * 若不跟着重新计算，返航点会静默指向错误的点（飞行安全相关，不能将就）。
 * 这里在每种会改变 seq 的操作里，用该操作自己已知的位置映射规则重算 returnWaypointSeq。
 */
function remapReturnSeq(m: Mission, remap: (oldSeq: number) => number | null): void {
  if (m.returnPointMode !== 'waypoint' || m.returnWaypointSeq == null) return
  const next = remap(m.returnWaypointSeq)
  if (next == null) {
    m.returnPointMode = 'home'
    m.returnWaypointSeq = null
  } else {
    m.returnWaypointSeq = next
  }
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
    toggleSetHomeMode: (v) => set((s) => ({ setHomeMode: v ?? !s.setHomeMode, addMode: false, setReturnMode: false })),

    setReturnMode: false,
    toggleSetReturnMode: (v) => set((s) => ({ setReturnMode: v ?? !s.setReturnMode, addMode: false, setHomeMode: false })),
    setReturnCustom: (ll) =>
      commit((m) => {
        m.returnPointMode = 'custom'
        m.returnLat = ll.lat
        m.returnLon = ll.lon
        return m
      }),
    setReturnPointMode: (mode) =>
      commit((m) => {
        m.returnPointMode = mode
        return m
      }),
    setReturnWaypoint: (seq) =>
      commit((m) => {
        m.returnPointMode = seq == null ? 'home' : 'waypoint'
        m.returnWaypointSeq = seq
        return m
      }),

    pendingBase: null,
    setPendingBase: (v) => set({ pendingBase: v }),

    select: (seq) => set({ selected: seq }),
    setAddMode: (v) => set({ addMode: v, setHomeMode: false, setReturnMode: false }),
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
        remapReturnSeq(m, (old) => (old >= idx + 2 ? old + 1 : old))
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
        remapReturnSeq(m, (old) => (old === seq ? null : old > seq ? old - 1 : old))
        return m
      })
      const sel = get().selected
      if (sel === seq) set({ selected: null })
    },

    clearAll: () => {
      commit((m) => {
        m.waypoints = []
        m.returnPointMode = m.returnPointMode === 'waypoint' ? 'home' : m.returnPointMode
        m.returnWaypointSeq = null
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
        remapReturnSeq(m, (old) => {
          const origIdx = old - 1
          if (origIdx === from) return to + 1
          if (from < to) return origIdx > from && origIdx <= to ? old - 1 : old
          return origIdx >= to && origIdx < from ? old + 1 : old
        })
        return m
      }),

    reverse: () =>
      commit((m) => {
        const n = m.waypoints.length
        m.waypoints = renumber([...m.waypoints].reverse())
        remapReturnSeq(m, (old) => n - old + 1)
        return m
      }),

    /** 把某个航点从航线里摘出来，成为新的起飞点。 */
    setWaypointAsHome: (seq) => {
      const wp = get().mission.waypoints.find((w) => w.seq === seq)
      if (!wp) return
      commit((m) => {
        m.waypoints = renumber(m.waypoints.filter((x) => x.seq !== seq))
        remapReturnSeq(m, (old) => (old === seq ? null : old > seq ? old - 1 : old))
        return m
      })
      set({ homeOverride: { lat: wp.lat, lon: wp.lon }, selected: null })
    },

    /** 把某个航点标记为返航点（仍保留在航线中）。 */
    setWaypointAsReturn: (seq) =>
      commit((m) => {
        m.returnPointMode = 'waypoint'
        m.returnWaypointSeq = seq
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
        if (mode === 'replace') {
          m.returnPointMode = m.returnPointMode === 'waypoint' ? 'home' : m.returnPointMode
          m.returnWaypointSeq = null
        }
        return m
      }),

    // 旋转/平移是"整条航线"的坐标变换：手动起飞点、自定义返航点若已设置，
    // 需要跟着一起变换，否则平移后航线飞走了、起降点却留在原地（反馈原文：缺少整体坐标平移）。
    rotate: (base, angleDeg) => {
      commit((m) => {
        m.waypoints = m.waypoints.map((w) => {
          const p = rotateAround(base, { lat: w.lat, lon: w.lon }, angleDeg)
          return { ...w, lat: p.lat, lon: p.lon }
        })
        if (m.returnPointMode === 'custom' && m.returnLat != null && m.returnLon != null) {
          const p = rotateAround(base, { lat: m.returnLat, lon: m.returnLon }, angleDeg)
          m.returnLat = p.lat
          m.returnLon = p.lon
        }
        return m
      })
      const home = get().homeOverride
      if (home) set({ homeOverride: rotateAround(base, home, angleDeg) })
    },

    translate: (north, east) => {
      commit((m) => {
        m.waypoints = m.waypoints.map((w) => {
          const p = offsetNE({ lat: w.lat, lon: w.lon }, north, east)
          return { ...w, lat: p.lat, lon: p.lon }
        })
        if (m.returnPointMode === 'custom' && m.returnLat != null && m.returnLon != null) {
          const p = offsetNE({ lat: m.returnLat, lon: m.returnLon }, north, east)
          m.returnLat = p.lat
          m.returnLon = p.lon
        }
        return m
      })
      const home = get().homeOverride
      if (home) set({ homeOverride: offsetNE(home, north, east) })
    },

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
