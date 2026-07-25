export interface Dms {
  deg: number
  min: number
  sec: number
  hemi: 'N' | 'S' | 'E' | 'W'
}

/** 十进制度 → 度分秒（含半球字母），axis 决定 N/S 还是 E/W。 */
export function toDMS(value: number, axis: 'lat' | 'lon'): Dms {
  const hemi: Dms['hemi'] = axis === 'lat' ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W'
  const abs = Math.abs(value)
  const deg = Math.floor(abs)
  const minFull = (abs - deg) * 60
  const min = Math.floor(minFull)
  const sec = (minFull - min) * 60
  return { deg, min, sec, hemi }
}

/** 度分秒 → 十进制度（S/W 半球取负）。 */
export function fromDMS(d: Dms): number {
  const v = d.deg + d.min / 60 + d.sec / 3600
  return d.hemi === 'S' || d.hemi === 'W' ? -v : v
}

export function formatDMS(d: Dms): string {
  return `${d.deg}°${d.min}'${d.sec.toFixed(1)}"${d.hemi}`
}
