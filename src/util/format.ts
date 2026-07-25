export const NA = 'N/A'

export function n(v: number | null | undefined, digits = 1, na = NA): string {
  if (v === null || v === undefined || Number.isNaN(v)) return na
  return v.toFixed(digits)
}

export function deg(rad: number, digits = 0): string {
  let d = (rad * 180) / Math.PI
  d = ((d % 360) + 360) % 360
  return d.toFixed(digits)
}

export function signedDeg(rad: number, digits = 1): string {
  return ((rad * 180) / Math.PI).toFixed(digits)
}

/** 秒 → mm:ss */
export function clock(sec: number): string {
  if (!sec || sec < 0) return '00:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function fixLabel(fix: string): string {
  const map: Record<string, string> = {
    none: '无',
    'no-fix': '未定位',
    '2d': '2D',
    '3d': '3D',
    dgps: 'DGPS',
    'rtk-float': 'RTK浮点',
    'rtk-fixed': 'RTK固定'
  }
  return map[fix] ?? fix
}
