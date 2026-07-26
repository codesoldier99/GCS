import { useEffect, useRef } from 'react'
import maplibregl, { Map as MlMap, Marker } from 'maplibre-gl'
import { buildStyle, MAP_LAYER_IDS } from './mapStyle'
import { useUi } from '../../state/uiStore'
import { useVehicle } from '../../state/vehicleStore'
import { useMapStore } from '../../state/mapStore'
import { isGcj02Active, toMapLngLat } from '../../util/coordTransform'
import { C } from '../../theme/tokens'

const HOME_DEFAULT: [number, number] = [113.400647, 22.889482]

export function FlightMap(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const rotRef = useRef<HTMLDivElement | null>(null)
  const homeMarkerRef = useRef<Marker | null>(null)
  const readyRef = useRef(false)

  const mapStyle = useUi((s) => s.mapStyle)
  const follow = useUi((s) => s.follow)

  // 初始化
  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(useUi.getState().mapStyle, useUi.getState().tiandituKey),
      center: HOME_DEFAULT,
      zoom: 17,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false
    })
    mapRef.current = map

    // 载具标记（旋转的箭头/机头）
    const el = document.createElement('div')
    el.style.cssText = 'width:34px;height:34px;display:grid;place-items:center;'
    const rot = document.createElement('div')
    rot.style.cssText = 'transition:transform .1s linear;filter:drop-shadow(0 0 6px rgba(23,212,230,.7));'
    rot.innerHTML = `<svg width="30" height="30" viewBox="0 0 24 24">
      <path d="M12 2 L18 20 L12 16 L6 20 Z" fill="${C.primary}" stroke="#04121a" stroke-width="1"/>
    </svg>`
    rotRef.current = rot
    el.appendChild(rot)
    markerRef.current = new maplibregl.Marker({ element: el }).setLngLat(HOME_DEFAULT).addTo(map)

    // 起飞点标记
    const hel = document.createElement('div')
    hel.style.cssText =
      'width:16px;height:16px;border-radius:50%;border:2px solid ' +
      C.success +
      ';background:rgba(34,224,138,.18);box-shadow:0 0 8px ' +
      C.success +
      ';'
    homeMarkerRef.current = new maplibregl.Marker({ element: hel }).setLngLat(HOME_DEFAULT)

    map.on('load', () => {
      map.addSource('track', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} }
      })
      map.addLayer({
        id: 'track-glow',
        type: 'line',
        source: 'track',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': C.primary, 'line-width': 7, 'line-opacity': 0.18, 'line-blur': 4 }
      })
      map.addLayer({
        id: 'track',
        type: 'line',
        source: 'track',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': C.primary, 'line-width': 2.4 }
      })
      readyRef.current = true
      useMapStore.getState().setMap(map)
    })

    const onZoom = (e: Event) => {
      const delta = (e as CustomEvent<number>).detail
      map.easeTo({ zoom: map.getZoom() + delta, duration: 200 })
    }
    window.addEventListener('map-zoom', onZoom)

    return () => {
      window.removeEventListener('map-zoom', onZoom)
      readyRef.current = false
      useMapStore.getState().setMap(null)
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 底图切换：遍历 mapStyle.ts 里注册的全部底图图层 id，不再硬编码只有两种底图。
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    for (const id of MAP_LAYER_IDS) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', id === mapStyle ? 'visible' : 'none')
      }
    }
  }, [mapStyle])

  // 遥测驱动：位置/朝向/轨迹/跟随
  // 国内厂商底图（高德/腾讯/天地图）用的是 GCJ02 加偏坐标系，飞机的真实 WGS84 坐标必须先转换
  // 一次再画到地图上，否则位置会偏出几百米（参考 Mission Planner 对国内地图的处理方式）。
  useEffect(() => {
    let raf = 0
    let lastHome = ''
    const loop = () => {
      const map = mapRef.current
      if (map && readyRef.current) {
        const { frame, track } = useVehicle.getState()
        const hasFix = frame.gpsFix !== 'none' && frame.gpsFix !== 'no-fix' && frame.lat !== 0
        if (hasFix) {
          const pos = toMapLngLat({ lat: frame.lat, lon: frame.lon })
          markerRef.current?.setLngLat(pos)
          if (rotRef.current) {
            rotRef.current.style.transform = `rotate(${(frame.yaw * 180) / Math.PI}deg)`
          }
          if (useUi.getState().follow) {
            map.easeTo({ center: pos, duration: 180 })
          }
        }
        // 起飞点
        if (frame.home) {
          const key = `${frame.home.lat.toFixed(6)},${frame.home.lon.toFixed(6)},${mapStyle}`
          if (key !== lastHome) {
            lastHome = key
            homeMarkerRef.current?.setLngLat(toMapLngLat({ lat: frame.home.lat, lon: frame.home.lon })).addTo(map)
          }
        }
        // 轨迹
        const src = map.getSource('track') as maplibregl.GeoJSONSource | undefined
        if (src) {
          const coords = isGcj02Active() ? track.map(([lon, lat]) => toMapLngLat({ lat, lon })) : track
          src.setData({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: coords },
            properties: {}
          })
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapStyle])

  // follow 打开时立即回中
  useEffect(() => {
    if (follow) {
      const f = useVehicle.getState().frame
      if (f.lat !== 0) mapRef.current?.easeTo({ center: toMapLngLat({ lat: f.lat, lon: f.lon }), duration: 300 })
    }
  }, [follow])

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
}
