import type { StyleSpecification } from 'maplibre-gl'
import type { MapStyleId } from '../../state/uiStore'

// 两个栅格底图共存，用可见性切换，避免 setStyle 丢图层。
export function buildStyle(active: MapStyleId): StyleSpecification {
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
      }
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#0b1220' } },
      {
        id: 'esri-sat',
        type: 'raster',
        source: 'esri-sat',
        layout: { visibility: active === 'esri-sat' ? 'visible' : 'none' }
      },
      {
        id: 'osm',
        type: 'raster',
        source: 'osm',
        layout: { visibility: active === 'osm' ? 'visible' : 'none' }
      }
    ]
  }
}
