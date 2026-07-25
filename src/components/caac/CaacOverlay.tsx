import { useEffect, useRef } from 'react'
import maplibregl, { Marker } from 'maplibre-gl'
import type { Map as MlMap } from 'maplibre-gl'
import { useMapStore } from '../../state/mapStore'
import { useCaac } from '../../state/caacStore'
import { circlePath, figure8FromPylons, figure8Path } from '../../util/figure8'
import { C } from '../../theme/tokens'

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

export function CaacOverlay(): null {
  const map = useMapStore((s) => s.map)
  const ready = useMapStore((s) => s.ready)
  const markers = useRef<Marker[]>([])

  useEffect(() => {
    if (!map || !ready) return

    if (!map.getSource('caac')) {
      map.addSource('caac', { type: 'geojson', data: EMPTY_FC })
      map.addLayer({
        id: 'caac-circles',
        type: 'line',
        source: 'caac',
        filter: ['==', ['get', 'kind'], 'circle'],
        paint: { 'line-color': C.primary, 'line-width': 1.8, 'line-opacity': 0.7, 'line-dasharray': [2, 2] }
      })
      map.addLayer({
        id: 'caac-fig-glow',
        type: 'line',
        source: 'caac',
        filter: ['==', ['get', 'kind'], 'fig'],
        paint: { 'line-color': C.accent, 'line-width': 7, 'line-opacity': 0.18, 'line-blur': 4 }
      })
      map.addLayer({
        id: 'caac-fig',
        type: 'line',
        source: 'caac',
        filter: ['==', ['get', 'kind'], 'fig'],
        paint: { 'line-color': C.accent, 'line-width': 2.4 }
      })
    }

    const render = (): void => rebuild(map, markers.current)
    const unsub = useCaac.subscribe(render)
    const onClick = (e: maplibregl.MapMouseEvent): void => {
      const st = useCaac.getState()
      if (st.placeMode === 'a') st.setPylon('a', { lat: e.lngLat.lat, lon: e.lngLat.lng })
      else if (st.placeMode === 'b') st.setPylon('b', { lat: e.lngLat.lat, lon: e.lngLat.lng })
    }
    map.on('click', onClick)
    render()

    return () => {
      unsub()
      markers.current.forEach((m) => m.remove())
      markers.current = []
      // sibling 组件（FlightMap）可能已经先 map.remove()，此时地图内部状态已销毁，
      // 后续调用会抛异常；这里静默降级，避免卸载期间的竞态把渲染树打崩。
      try {
        map.off('click', onClick)
        for (const id of ['caac-fig', 'caac-fig-glow', 'caac-circles']) if (map.getLayer(id)) map.removeLayer(id)
        if (map.getSource('caac')) map.removeSource('caac')
      } catch {
        /* map 已被销毁，无需清理 */
      }
    }
  }, [map, ready])

  return null
}

function pylonEl(label: string): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText =
    'width:30px;height:30px;border-radius:6px;display:grid;place-items:center;' +
    'font:700 13px var(--font-num);color:#04121a;background:' + C.primary + ';' +
    'border:2px solid #04121a;box-shadow:0 0 10px ' + C.primaryGlow + ';transform:rotate(45deg);'
  const span = document.createElement('span')
  span.textContent = label
  span.style.transform = 'rotate(-45deg)'
  el.appendChild(span)
  return el
}

function rebuild(map: MlMap, markers: Marker[]): void {
  const { pylonA, pylonB } = useCaac.getState()
  const features: GeoJSON.Feature[] = []

  if (pylonA && pylonB) {
    const f = figure8FromPylons(pylonA, pylonB)
    for (const c of [f.a, f.b]) {
      features.push({
        type: 'Feature',
        properties: { kind: 'circle' },
        geometry: { type: 'LineString', coordinates: circlePath(c, f.radius).map((p) => [p.lon, p.lat]) }
      })
    }
    features.push({
      type: 'Feature',
      properties: { kind: 'fig' },
      geometry: { type: 'LineString', coordinates: figure8Path(f).map((p) => [p.lon, p.lat]) }
    })
  }
  const src = map.getSource('caac') as maplibregl.GeoJSONSource | undefined
  src?.setData({ type: 'FeatureCollection', features })

  // 桩标记
  const wanted: { ll: { lat: number; lon: number }; label: string }[] = []
  if (pylonA) wanted.push({ ll: pylonA, label: 'A' })
  if (pylonB) wanted.push({ ll: pylonB, label: 'B' })
  while (markers.length > wanted.length) markers.pop()!.remove()
  while (markers.length < wanted.length) {
    markers.push(new maplibregl.Marker({ element: pylonEl('?') }).setLngLat([0, 0]).addTo(map))
  }
  wanted.forEach((w, i) => {
    markers[i].setLngLat([w.ll.lon, w.ll.lat])
    const span = markers[i].getElement().querySelector('span')
    if (span) span.textContent = w.label
  })
}
