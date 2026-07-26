import { useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import { useMapStore } from '../../state/mapStore'
import { toMapLngLat } from '../../util/coordTransform'
import { C } from '../../theme/tokens'

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

/** 航线模板生成前的实时地图预览（虚线+落点），在 TemplateDialog 调参时同步更新，确认前可直接在真实地图上核对。 */
export function TemplatePreviewOverlay(): null {
  const map = useMapStore((s) => s.map)
  const ready = useMapStore((s) => s.ready)

  useEffect(() => {
    if (!map || !ready) return
    if (!map.getSource('tpl-preview')) {
      map.addSource('tpl-preview', { type: 'geojson', data: EMPTY })
      map.addLayer({
        id: 'tpl-preview-glow',
        type: 'line',
        source: 'tpl-preview',
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: { 'line-color': C.accent, 'line-width': 6, 'line-opacity': 0.2, 'line-blur': 3 }
      })
      map.addLayer({
        id: 'tpl-preview-line',
        type: 'line',
        source: 'tpl-preview',
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: { 'line-color': C.accent, 'line-width': 2, 'line-dasharray': [2, 1.5] }
      })
      map.addLayer({
        id: 'tpl-preview-pts',
        type: 'circle',
        source: 'tpl-preview',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 4,
          'circle-color': C.accent,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#04121a'
        }
      })
    }

    const render = (): void => {
      const pts = useMapStore.getState().templatePreview
      const src = map.getSource('tpl-preview') as maplibregl.GeoJSONSource | undefined
      if (!pts || pts.length === 0) {
        src?.setData(EMPTY)
        return
      }
      const coords = pts.map(toMapLngLat)
      const features: GeoJSON.Feature[] = [
        { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
        ...coords.map((c): GeoJSON.Feature => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } }))
      ]
      src?.setData({ type: 'FeatureCollection', features })
    }
    const unsub = useMapStore.subscribe(render)
    render()

    return () => {
      unsub()
      try {
        for (const id of ['tpl-preview-pts', 'tpl-preview-line', 'tpl-preview-glow']) if (map.getLayer(id)) map.removeLayer(id)
        if (map.getSource('tpl-preview')) map.removeSource('tpl-preview')
      } catch {
        /* map 已被销毁，无需清理 */
      }
    }
  }, [map, ready])

  return null
}
