/** 航线规划数值限位（对齐 CAAC 培训场景的合理量级）。 */
export const LIMITS = {
  altMin: 1,
  // 民航法规常规限高为 120m，但地面站考试科目常出现 300/500m 的题目，
  // 故软件侧放宽到 1000m；120m 以上会有视觉提示，但不阻塞输入。
  altMax: 1000,
  altRegulatory: 120,
  speedMin: 0.5,
  speedMax: 15,
  hoverMin: 0,
  hoverMax: 600,
  loopMax: 999,
  latMin: -90,
  latMax: 90,
  lonMin: -180,
  lonMax: 180,
  // 模板/批量生成航点数量上限：超过此值曾导致折线渲染卡死或飞控拒绝任务。
  templateCountMax: 360
} as const

export function clamp(v: number, min?: number, max?: number): number {
  if (!Number.isFinite(v)) return min ?? 0
  let r = v
  if (min != null) r = Math.max(min, r)
  if (max != null) r = Math.min(max, r)
  return r
}
