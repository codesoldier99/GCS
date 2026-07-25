// 地理计算工具（WGS84 球面近似，适合中短距离航线规划）。

const R = 6378137
const D2R = Math.PI / 180
const R2D = 180 / Math.PI

export interface LL {
  lat: number
  lon: number
}

/** 两点间距离（米） */
export function haversine(a: LL, b: LL): number {
  const dLat = (b.lat - a.lat) * D2R
  const dLon = (b.lon - a.lon) * D2R
  const la1 = a.lat * D2R
  const la2 = b.lat * D2R
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** 初始方位角（度，0..360，正北为 0，顺时针） */
export function bearing(a: LL, b: LL): number {
  const la1 = a.lat * D2R
  const la2 = b.lat * D2R
  const dLon = (b.lon - a.lon) * D2R
  const y = Math.sin(dLon) * Math.cos(la2)
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon)
  return (Math.atan2(y, x) * R2D + 360) % 360
}

/** 从起点按方位角(度)与距离(米)推算目标点 */
export function destination(from: LL, bearingDeg: number, distM: number): LL {
  const d = distM / R
  const brng = bearingDeg * D2R
  const la1 = from.lat * D2R
  const lo1 = from.lon * D2R
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(brng))
  const lo2 =
    lo1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(la1),
      Math.cos(d) - Math.sin(la1) * Math.sin(la2)
    )
  return { lat: la2 * R2D, lon: ((lo2 * R2D + 540) % 360) - 180 }
}

/** 按北向/东向米数平移 */
export function offsetNE(from: LL, north: number, east: number): LL {
  const dist = Math.hypot(north, east)
  if (dist < 1e-6) return { ...from }
  const brg = (Math.atan2(east, north) * R2D + 360) % 360
  return destination(from, brg, dist)
}

/** 绕基点旋转 angleDeg（顺时针为正） */
export function rotateAround(base: LL, p: LL, angleDeg: number): LL {
  const dist = haversine(base, p)
  if (dist < 1e-6) return { ...p }
  const brg = bearing(base, p)
  return destination(base, brg + angleDeg, dist)
}
