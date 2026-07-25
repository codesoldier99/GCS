import { create } from 'zustand'
import type { LL } from '../util/geo'
import { figure8FromPylons, lateralDeviation, type Figure8 } from '../util/figure8'
import type { TelemetryFrame } from '@shared/telemetry'

export type PlaceMode = 'none' | 'a' | 'b'
export type ExamResult = 'none' | 'pass' | 'fail'

export interface Metrics {
  time: number // s
  laps: number // 完整 8 字数
  crossings: number
  maxDeviation: number // m
  avgDeviation: number // m
  altHoldMax: number // m
  samples: number
}

interface CaacState {
  pylonA: LL | null
  pylonB: LL | null
  radius: number
  placeMode: PlaceMode
  running: boolean
  result: ExamResult
  metrics: Metrics
  refAlt: number
  devTol: number
  altTol: number
  reqLaps: number
  // 内部
  _startT: number
  _sumDev: number
  _side: 'A' | 'B' | null

  setRadius: (r: number) => void
  setPlaceMode: (m: PlaceMode) => void
  setPylon: (which: 'a' | 'b', ll: LL) => void
  setPylons: (a: LL, b: LL) => void
  start: (frame: TelemetryFrame) => void
  stop: () => void
  reset: () => void
  sample: (frame: TelemetryFrame) => void
  figure8: () => Figure8 | null
}

const zeroMetrics = (): Metrics => ({
  time: 0,
  laps: 0,
  crossings: 0,
  maxDeviation: 0,
  avgDeviation: 0,
  altHoldMax: 0,
  samples: 0
})

export const useCaac = create<CaacState>((set, get) => ({
  pylonA: null,
  pylonB: null,
  radius: 30,
  placeMode: 'none',
  running: false,
  result: 'none',
  metrics: zeroMetrics(),
  refAlt: 0,
  devTol: 3,
  altTol: 2,
  reqLaps: 1,
  _startT: 0,
  _sumDev: 0,
  _side: null,

  setRadius: (r) => set({ radius: r }),
  setPlaceMode: (m) => set({ placeMode: m }),
  setPylon: (which, ll) =>
    set(which === 'a' ? { pylonA: ll, placeMode: 'none' } : { pylonB: ll, placeMode: 'none' }),
  setPylons: (a, b) => set({ pylonA: a, pylonB: b }),

  start: (frame) =>
    set({
      running: true,
      result: 'none',
      metrics: zeroMetrics(),
      refAlt: frame.relAlt,
      _startT: frame.t,
      _sumDev: 0,
      _side: null
    }),

  stop: () => {
    const { metrics, reqLaps, devTol, altTol } = get()
    const pass =
      metrics.laps >= reqLaps && metrics.maxDeviation <= devTol && metrics.altHoldMax <= altTol
    set({ running: false, result: metrics.samples > 0 ? (pass ? 'pass' : 'fail') : 'none' })
  },

  reset: () => set({ running: false, result: 'none', metrics: zeroMetrics(), _side: null }),

  sample: (frame) => {
    const s = get()
    if (!s.running) return
    const f = s.figure8()
    if (!f) return
    const p = { lat: frame.lat, lon: frame.lon }
    const dev = lateralDeviation(f, p)
    const altDev = Math.abs(frame.relAlt - s.refAlt)

    // 判定当前所处圆（近 A 还是近 B）
    const near: 'A' | 'B' =
      haversine2(p, f.a) < haversine2(p, f.b) ? 'A' : 'B'
    let crossings = s.metrics.crossings
    if (s._side && near !== s._side) crossings++

    const samples = s.metrics.samples + 1
    const sumDev = s._sumDev + dev
    set({
      _side: near,
      _sumDev: sumDev,
      metrics: {
        time: (frame.t - s._startT) / 1000,
        crossings,
        laps: Math.floor(crossings / 2),
        maxDeviation: Math.max(s.metrics.maxDeviation, dev),
        avgDeviation: sumDev / samples,
        altHoldMax: Math.max(s.metrics.altHoldMax, altDev),
        samples
      }
    })
  },

  figure8: () => {
    const { pylonA, pylonB } = get()
    if (!pylonA || !pylonB) return null
    return figure8FromPylons(pylonA, pylonB)
  }
}))

function haversine2(a: LL, b: LL): number {
  const dLat = b.lat - a.lat
  const dLon = b.lon - a.lon
  return dLat * dLat + dLon * dLon // 仅用于比较远近，无需真实距离
}
