import { useEffect, useRef } from 'react'
import maplibregl, { Marker } from 'maplibre-gl'
import { useMapStore } from '../../state/mapStore'
import { haversine } from '../../util/geo'
import { toMapLngLat, fromMapLngLat } from '../../util/coordTransform'
import { C } from '../../theme/tokens'

const EMPTY: GeoJSON.Feature = { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} }

function makeDotEl(): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText =
    'width:10px;height:10px;border-radius:50%;background:' + C.accent + ';border:2px solid #04121a;' +
    'box-shadow:0 0 8px ' + C.accent + '99;pointer-events:none;'
  return el
}

function makeLabelEl(): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText =
    'padding:3px 8px;border-radius:5px;font:600 11px var(--font-num);white-space:nowrap;' +
    'color:' + C.textHi + ';background:rgba(8,12,20,.88);border:1px solid ' + C.accent + ';' +
    'transform:translateY(-2px);pointer-events:none;'
  return el
}

/** 测距工具：地图上依次点击落点，实时显示分段与累计距离；再次点击工具栏按钮或 Esc 结束。 */
export function MeasureTool(): null {
  const map = useMapStore((s) => s.map)
  const ready = useMapStore((s) => s.ready)
  const dotsRef = useRef<Marker[]>([])
  const labelsRef = useRef<Marker[]>([])
  const totalLabelRef = useRef<Marker | null>(null)

  useEffect(() => {
    if (!map || !ready) return
    if (!map.getSource('measure')) {
      map.addSource('measure', { type: 'geojson', data: EMPTY })
      map.addLayer({
        id: 'measure-line',
        type: 'line',
        source: 'measure',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': C.accent, 'line-width': 2, 'line-dasharray': [2, 2] }
      })
    }

    const render = (): void => {
      // 测距点全程 WGS84（haversine 距离计算需要真实坐标），只在画到地图上时转换坐标系
      const { measurePoints } = useMapStore.getState()
      const src = map.getSource('measure') as maplibregl.GeoJSONSource | undefined
      src?.setData({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: measurePoints.map(toMapLngLat) },
        properties: {}
      })

      while (dotsRef.current.length < measurePoints.length) {
        dotsRef.current.push(new maplibregl.Marker({ element: makeDotEl() }).setLngLat([0, 0]).addTo(map))
      }
      while (dotsRef.current.length > measurePoints.length) dotsRef.current.pop()!.remove()
      measurePoints.forEach((p, i) => dotsRef.current[i].setLngLat(toMapLngLat(p)))

      const segCount = Math.max(0, measurePoints.length - 1)
      while (labelsRef.current.length < segCount) {
        labelsRef.current.push(new maplibregl.Marker({ element: makeLabelEl() }).setLngLat([0, 0]).addTo(map))
      }
      while (labelsRef.current.length > segCount) labelsRef.current.pop()!.remove()
      let total = 0
      for (let i = 0; i < segCount; i++) {
        const d = haversine(measurePoints[i], measurePoints[i + 1])
        total += d
        const mid = {
          lon: (measurePoints[i].lon + measurePoints[i + 1].lon) / 2,
          lat: (measurePoints[i].lat + measurePoints[i + 1].lat) / 2
        }
        labelsRef.current[i].setLngLat(toMapLngLat(mid))
        labelsRef.current[i].getElement().textContent = `${d.toFixed(1)}m`
      }

      if (measurePoints.length > 1) {
        if (!totalLabelRef.current) {
          totalLabelRef.current = new maplibregl.Marker({ element: makeLabelEl() }).addTo(map)
        }
        const last = measurePoints[measurePoints.length - 1]
        totalLabelRef.current.setLngLat(toMapLngLat(last))
        totalLabelRef.current.getElement().textContent = `合计 ${total.toFixed(1)}m`
      } else {
        totalLabelRef.current?.remove()
        totalLabelRef.current = null
      }
    }

    const unsub = useMapStore.subscribe(render)
    const onClick = (e: maplibregl.MapMouseEvent): void => {
      const st = useMapStore.getState()
      if (st.measureMode) st.addMeasurePoint(fromMapLngLat(e.lngLat.lat, e.lngLat.lng))
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') useMapStore.getState().clearMeasure()
    }
    map.on('click', onClick)
    window.addEventListener('keydown', onKey)
    render()

    return () => {
      unsub()
      window.removeEventListener('keydown', onKey)
      dotsRef.current.forEach((m) => m.remove())
      labelsRef.current.forEach((m) => m.remove())
      totalLabelRef.current?.remove()
      dotsRef.current = []
      labelsRef.current = []
      totalLabelRef.current = null
      try {
        map.off('click', onClick)
        if (map.getLayer('measure-line')) map.removeLayer('measure-line')
        if (map.getSource('measure')) map.removeSource('measure')
      } catch {
        /* map 已被销毁，无需清理 */
      }
    }
  }, [map, ready])

  return null
}
