/** 航线规划数值限位（对齐 CAAC 培训场景的合理量级）。 */
export const LIMITS = {
  altMin: 1,
  altMax: 120, // 民航法规通用限高
  speedMin: 0.5,
  speedMax: 15,
  hoverMin: 0,
  hoverMax: 600,
  loopMax: 999,
  latMin: -90,
  latMax: 90,
  lonMin: -180,
  lonMax: 180
} as const

export function clamp(v: number, min?: number, max?: number): number {
  if (!Number.isFinite(v)) return min ?? 0
  let r = v
  if (min != null) r = Math.max(min, r)
  if (max != null) r = Math.min(max, r)
  return r
}
