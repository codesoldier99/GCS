import type { StyleSpecification } from 'maplibre-gl'
import type { MapStyleId } from '../../state/uiStore'
import { MAP_PROVIDERS } from '../../state/uiStore'

/** 所有底图图层 id，与 MAP_PROVIDERS 的 id 一一对应；FlightMap 切换底图可见性时按这份列表遍历，不必硬编码。 */
export const MAP_LAYER_IDS: MapStyleId[] = MAP_PROVIDERS.map((p) => p.id)

// 多底图共存，用可见性切换，避免 setStyle 丢图层。国内厂商底图（高德/腾讯/天地图）
// 用的是公开、无需申请的社区常用瓦片地址（天地图除外，法规要求必须用申请到的 Key）；
// 这些图源坐标系是 GCJ02，本身瓦片内容不需要转换——需要转换的是叠加在上面的
// 飞机/航点标记坐标，见 util/coordTransform.ts 与 FlightMap/MissionOverlay 里的用法。
export function buildStyle(active: MapStyleId, tiandituKey = ''): StyleSpecification {
  const tk = tiandituKey || 'placeholder' // 空 key 时仍生成合法 URL，只是请求会 403，不影响其余底图工作
  return {
    version: 8,
    sources: {
      'esri-sat': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        ],
        tileSize: 256,
        attribution: 'Esri, Maxar, Earthstar Geographics'
      },
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap'
      },
      'amap-sat': {
        type: 'raster',
        tiles: ['https://webst01.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}'],
        tileSize: 256,
        attribution: '高德地图 GS(2023)1512号'
      },
      'amap-vec': {
        type: 'raster',
        tiles: ['https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}'],
        tileSize: 256,
        attribution: '高德地图 GS(2023)1512号'
      },
      tencent: {
        type: 'raster',
        tiles: ['https://rt0.map.gtimg.com/realtimerender?z={z}&x={x}&y={y}&type=vector&style=0'],
        tileSize: 256,
        attribution: '腾讯地图 GS(2023)1171号'
      },
      tianditu: {
        type: 'raster',
        tiles: [`https://t0.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=${tk}`],
        tileSize: 256,
        attribution: '天地图 GS(2022)3124号'
      }
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#0b1220' } },
      ...MAP_LAYER_IDS.map((id) => ({
        id,
        type: 'raster' as const,
        source: id,
        layout: { visibility: (id === active ? 'visible' : 'none') as 'visible' | 'none' }
      }))
    ]
  }
}
