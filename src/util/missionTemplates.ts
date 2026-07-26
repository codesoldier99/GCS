import { destination, offsetNE, type LL } from './geo'
import { LIMITS } from './limits'
import type { TurnMode, Waypoint } from '@shared/mission'

const D2R = Math.PI / 180

export interface TemplateCommon {
  alt: number
  speed: number
  turnMode: TurnMode
  hoverTime: number
}

function wp(p: LL, c: TemplateCommon, heading = 0): Waypoint {
  return {
    seq: 0,
    lat: p.lat,
    lon: p.lon,
    alt: c.alt,
    speed: c.speed,
    turnMode: c.turnMode,
    hoverTime: c.hoverTime,
    heading
  }
}

/** 局部 北/东(米) 先按 heading 旋转再从基点偏移 */
function local(base: LL, north: number, east: number, headingDeg: number): LL {
  const th = headingDeg * D2R
  const n = north * Math.cos(th) - east * Math.sin(th)
  const e = north * Math.sin(th) + east * Math.cos(th)
  return offsetNE(base, n, e)
}

/** 圆形 */
export function circleTemplate(
  base: LL,
  radius: number,
  count: number,
  startAngle: number,
  c: TemplateCommon
): Waypoint[] {
  const out: Waypoint[] = []
  const n = Math.min(LIMITS.templateCountMax, Math.max(3, Math.round(count)))
  for (let i = 0; i < n; i++) {
    const a = startAngle + (i * 360) / n
    out.push(wp(destination(base, a, radius), c, a))
  }
  return out
}

/** 星形（points 个角，内径 = 外径 * innerRatio） */
export function starTemplate(
  base: LL,
  radius: number,
  points: number,
  startAngle: number,
  c: TemplateCommon,
  innerRatio = 0.42
): Waypoint[] {
  const out: Waypoint[] = []
  const p = Math.min(Math.floor(LIMITS.templateCountMax / 2), Math.max(3, Math.round(points)))
  for (let i = 0; i < p; i++) {
    const ao = startAngle + (i * 360) / p
    out.push(wp(destination(base, ao, radius), c, ao))
    const ai = ao + 180 / p
    out.push(wp(destination(base, ai, radius * innerRatio), c, ai))
  }
  return out
}

export type Corner = 'tl' | 'tr' | 'bl' | 'br'

/** 弓形（扫描线 / lawnmower）。length=单程长度, width=总宽, count=航点数, heading=航向 */
export function boustrophedonTemplate(
  base: LL,
  length: number,
  width: number,
  count: number,
  corner: Corner,
  heading: number,
  c: TemplateCommon
): Waypoint[] {
  const passes = Math.min(Math.floor(LIMITS.templateCountMax / 2), Math.max(2, Math.round(count / 2)))
  const spacing = passes > 1 ? width / (passes - 1) : 0
  // 角落方向符号：地图上"上"=北，"下"=南。从上边(tl/tr)出发要向南扫描，
  // 从下边(bl/br)出发要向北扫描；从右边(tr/br)出发要向西扫描，从左边(tl/bl)出发要向东扫描。
  const sN = corner === 'tl' || corner === 'tr' ? -1 : 1
  const sE = corner === 'tr' || corner === 'br' ? -1 : 1
  const out: Waypoint[] = []
  for (let p = 0; p < passes; p++) {
    const e = sE * p * spacing
    const near = { n: 0, f: sN * length }
    const pts = p % 2 === 0 ? [0, near.f] : [near.f, 0]
    for (const n of pts) out.push(wp(local(base, n, e, heading), c, heading))
  }
  return out
}
