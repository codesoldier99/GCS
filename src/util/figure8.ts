import { bearing, destination, haversine, offsetNE, type LL } from './geo'

/**
 * 绕八字（两电子桩）几何。
 * 两桩 A、B 间距约为 2r，两圆半径 r，共享中心穿越点 M（中点）。
 * 无人机绕 A 一圈再绕 B 一圈，于 M 交叉，形成 8 字。
 */

export interface Figure8 {
  a: LL
  b: LL
  center: LL
  radius: number
}

/** 由两桩位置构造八字（半径取 |A-M|） */
export function figure8FromPylons(a: LL, b: LL): Figure8 {
  const center = { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 }
  const radius = haversine(a, center)
  return { a, b, center, radius }
}

/** 以起飞点为中心，沿 heading 方向自动布两桩，间距 2r */
export function autoPylons(home: LL, radius: number, headingDeg = 90): { a: LL; b: LL } {
  return {
    a: destination(home, headingDeg + 180, radius),
    b: destination(home, headingDeg, radius)
  }
}

/** 生成理想八字路径采样点（用于地图绘制），n 越大越平滑 */
export function figure8Path(f: Figure8, n = 160): LL[] {
  const bAB = bearing(f.a, f.b) // A→B 方位（东向轴）
  const pts: LL[] = []
  for (let i = 0; i <= n; i++) {
    const u = i / n
    pts.push(pointAt(f, bAB, u))
  }
  return pts
}

/** 路径参数 u∈[0,1) → 经纬。局部坐标：x 沿 A→B，y 垂直。 */
export function pointAt(f: Figure8, bAB: number, u: number): LL {
  const r = f.radius
  let x: number
  let y: number
  if (u < 0.5) {
    // 绕 A 一圈（A 在 M 的 -x 侧，起于 M）
    const t = (u / 0.5) * Math.PI * 2
    x = -r + r * Math.cos(t)
    y = r * Math.sin(t)
  } else {
    // 绕 B 一圈（B 在 +x 侧，起于 M，反向）
    const t = Math.PI - ((u - 0.5) / 0.5) * Math.PI * 2
    x = r + r * Math.cos(t)
    y = r * Math.sin(t)
  }
  // 局部(x 沿 bAB, y 垂直左手) → NE
  const th = (bAB * Math.PI) / 180
  const north = x * Math.cos(th) - y * Math.sin(th)
  const east = x * Math.sin(th) + y * Math.cos(th)
  return offsetNE(f.center, north, east)
}

/** 无人机到理想八字的横向偏差（到较近圆环的距离，米） */
export function lateralDeviation(f: Figure8, p: LL): number {
  const da = Math.abs(haversine(p, f.a) - f.radius)
  const db = Math.abs(haversine(p, f.b) - f.radius)
  return Math.min(da, db)
}

/** 生成一个圆的经纬点（画桩圆用） */
export function circlePath(center: LL, radius: number, n = 72): LL[] {
  const pts: LL[] = []
  for (let i = 0; i <= n; i++) pts.push(destination(center, (i * 360) / n, radius))
  return pts
}
