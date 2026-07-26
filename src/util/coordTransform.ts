import type { LL } from './geo'
import { useUi, mapProviderMeta } from '../state/uiStore'

/**
 * WGS84 ⇄ GCJ02（"火星坐标系"）互转。
 *
 * 国内高德/腾讯等地图服务商按法规必须对地图数据加偏——同一 WGS84 坐标在这些底图上
 * 会偏移出几百米，直接把 GPS 经纬度当像素点画上去会明显对不上路网/建筑。
 * Mission Planner 等成熟地面站的做法是：底层数据（航点、飞机位置）始终保持 WGS84 不变，
 * 只在"渲染到这类底图 / 从这类底图取用户点击坐标"这两个边界上做一次转换——
 * 这里的算法就是业界通用的 eviltransform/GCJ02 实现（国测局公开的加偏算法）。
 *
 * 注意：这不是"精确纠偏"，中国大陆境外的坐标不加偏（原样返回），
 * 与高德官方 SDK 行为一致。
 */

const A = 6378245.0
const EE = 0.00669342162296594323

function outOfChina(lat: number, lon: number): boolean {
  return lon < 72.004 || lon > 137.8347 || lat < 0.8293 || lat > 55.8271
}

function transformLat(x: number, y: number): number {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0
  ret += ((20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin((y / 3.0) * Math.PI)) * 2.0) / 3.0
  ret += ((160.0 * Math.sin((y / 12.0) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30.0)) * 2.0) / 3.0
  return ret
}

function transformLon(x: number, y: number): number {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0
  ret += ((20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin((x / 3.0) * Math.PI)) * 2.0) / 3.0
  ret += ((150.0 * Math.sin((x / 12.0) * Math.PI) + 300.0 * Math.sin((x / 30.0) * Math.PI)) * 2.0) / 3.0
  return ret
}

/** WGS84 → GCJ02（真实 GPS 坐标 → 高德/腾讯底图坐标，用于把飞机/航点画到这类底图上）。 */
export function wgs84ToGcj02(p: LL): LL {
  if (outOfChina(p.lat, p.lon)) return p
  const dLat0 = transformLat(p.lon - 105.0, p.lat - 35.0)
  const dLon0 = transformLon(p.lon - 105.0, p.lat - 35.0)
  const radLat = (p.lat / 180.0) * Math.PI
  let magic = Math.sin(radLat)
  magic = 1 - EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  const dLat = (dLat0 * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * Math.PI)
  const dLon = (dLon0 * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * Math.PI)
  return { lat: p.lat + dLat, lon: p.lon + dLon }
}

/** GCJ02 → WGS84（从高德/腾讯底图上取的点击坐标 → 存回真实 GPS 坐标），用牛顿迭代法反解。 */
export function gcj02ToWgs84(p: LL): LL {
  if (outOfChina(p.lat, p.lon)) return p
  let lat = p.lat
  let lon = p.lon
  // 迭代收敛到 ~mm 级精度即可，6 次足够
  for (let i = 0; i < 6; i++) {
    const guess = wgs84ToGcj02({ lat, lon })
    lat += p.lat - guess.lat
    lon += p.lon - guess.lon
  }
  return { lat, lon }
}

/* ------------------------------------------------------------------ *
 * 下面这组是给地图渲染层用的便捷封装：业务数据（航点/飞机位置/测距点）
 * 全程只使用 WGS84；只有在"往地图上摆一个 marker"或"读取一次地图点击坐标"
 * 这两个边界点上，才需要按当前底图的坐标系做一次转换。
 * ------------------------------------------------------------------ */

/** 当前选中的底图是否是 GCJ02 加偏坐标系（高德/腾讯/天地图）。 */
export function isGcj02Active(): boolean {
  return mapProviderMeta(useUi.getState().mapStyle).datum === 'gcj02'
}

/** WGS84 → 当前底图应该使用的 [lon, lat]（画 marker/折线时用）。 */
export function toMapLngLat(p: LL): [number, number] {
  if (!isGcj02Active()) return [p.lon, p.lat]
  const g = wgs84ToGcj02(p)
  return [g.lon, g.lat]
}

/** 当前底图上取到的点击坐标 → WGS84（写入航点/起飞点/测距点等业务数据前调用）。 */
export function fromMapLngLat(lat: number, lon: number): LL {
  if (!isGcj02Active()) return { lat, lon }
  return gcj02ToWgs84({ lat, lon })
}
