import { useEffect, useRef, useState } from 'react'
import maplibregl, { Marker } from 'maplibre-gl'
import type { Map as MlMap } from 'maplibre-gl'
import { useMapStore } from '../../state/mapStore'
import { useMission } from '../../state/missionStore'
import { useVehicle } from '../../state/vehicleStore'
import { haversine, bearing } from '../../util/geo'
import { getEffectiveHome } from '../../util/effectiveHome'
import { C } from '../../theme/tokens'
import { WaypointContextMenu } from './WaypointContextMenu'

interface WpMarker extends Marker {
  _seq?: number
}

const EMPTY: GeoJSON.Feature = {
  type: 'Feature',
  geometry: { type: 'LineString', coordinates: [] },
  properties: {}
}

export function MissionOverlay(): JSX.Element | null {
  const map = useMapStore((s) => s.map)
  const ready = useMapStore((s) => s.ready)
  const wpRef = useRef<WpMarker[]>([])
  const labelRef = useRef<Marker[]>([])
  const homeMarkerRef = useRef<Marker | null>(null)
  const draggingSeq = useRef<number | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ seq: number; x: number; y: number } | null>(null)

  useEffect(() => {
    if (!map || !ready) return

    if (!map.getSource('mission')) {
      map.addSource('mission', { type: 'geojson', data: EMPTY })
      map.addLayer({
        id: 'mission-glow',
        type: 'line',
        source: 'mission',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': C.success, 'line-width': 8, 'line-opacity': 0.16, 'line-blur': 4 }
      })
      map.addLayer({
        id: 'mission-line',
        type: 'line',
        source: 'mission',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': C.success, 'line-width': 2.6 }
      })
    }

    /** 新建一个航点 marker 并绑定拖拽/点选/右键事件（需要闭包内的 map/state，故不放在模块级）。 */
    const createWpMarker = (): WpMarker => {
      const el = makeWpEl()
      const marker: WpMarker = new maplibregl.Marker({ element: el, draggable: true }).setLngLat([0, 0]).addTo(map)
      // 注意：这里不能 stopPropagation mousedown —— MapLibre 的 Marker 拖拽是通过
      // map.on('mousedown', ...) 在地图容器上监听实现的（见 maplibre-gl 源码 _addDragHandler），
      // 若在 marker 元素上挡掉 mousedown 冒泡，拖拽会永远无法触发（这正是"航点无法直接拖动"的根因）。
      // MapLibre 自己会在检测到目标是可拖拽 marker 时 preventDefault()，不会误触发地图平移。
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        if (marker._seq) useMission.getState().select(marker._seq)
      })
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (marker._seq) setCtxMenu({ seq: marker._seq, x: e.clientX, y: e.clientY })
      })
      marker.on('dragstart', () => {
        el.style.cursor = 'grabbing'
        draggingSeq.current = marker._seq ?? null
        if (marker._seq) useMission.getState().select(marker._seq)
      })
      marker.on('drag', () => {
        // 拖拽中只更新折线预览，不写 store：写 store 会触发整店订阅 rebuild，
        // 把这个正在被拖拽的 marker 按旧坐标 setLngLat 回去，导致"拖不动"。
        const ll = marker.getLngLat()
        if (marker._seq) liveLine(map, marker._seq, ll.lat, ll.lng)
      })
      marker.on('dragend', () => {
        el.style.cursor = 'grab'
        const ll = marker.getLngLat()
        const seq = marker._seq
        draggingSeq.current = null
        if (seq) {
          useMission.getState().moveWaypoint(seq, ll.lat, ll.lng)
          // MapLibre 在检测到拖拽位移后会吞掉随之而来的 click，这里兜底确保拖完即选中，
          // 单航点编辑面板才能可靠弹出。
          useMission.getState().select(seq)
        }
      })
      return marker
    }

    const render = (): void => rebuild(map, wpRef.current, labelRef.current, homeMarkerRef, draggingSeq.current, createWpMarker)

    const unsubM = useMission.subscribe(render)
    const unsubV = useVehicle.subscribe((s, p) => {
      if (s.frame.home !== p.frame.home) render()
    })

    const onClick = (e: maplibregl.MapMouseEvent): void => {
      const st = useMission.getState()
      if (st.setHomeMode) {
        st.setHomeOverride({ lat: e.lngLat.lat, lon: e.lngLat.lng })
        return
      }
      if (st.addMode) st.addWaypoint(e.lngLat.lat, e.lngLat.lng)
    }
    const onFit = (): void => fitToMission(map)
    map.on('click', onClick)
    window.addEventListener('mission-fit', onFit)
    render()

    return () => {
      unsubM()
      unsubV()
      window.removeEventListener('mission-fit', onFit)
      wpRef.current.forEach((m) => m.remove())
      labelRef.current.forEach((m) => m.remove())
      homeMarkerRef.current?.remove()
      wpRef.current = []
      labelRef.current = []
      homeMarkerRef.current = null
      // sibling 组件（FlightMap）可能已先执行 map.remove()，此时地图内部状态已销毁，
      // 后续调用会抛异常；这里静默降级，避免路由切换期间的竞态把渲染树打崩（黑屏/卡死）。
      try {
        map.off('click', onClick)
        for (const id of ['mission-line', 'mission-glow']) if (map.getLayer(id)) map.removeLayer(id)
        if (map.getSource('mission')) map.removeSource('mission')
      } catch {
        /* map 已被销毁，无需清理 */
      }
    }
  }, [map, ready])

  return ctxMenu ? (
    <WaypointContextMenu seq={ctxMenu.seq} x={ctxMenu.x} y={ctxMenu.y} onClose={() => setCtxMenu(null)} />
  ) : null
}

function makeWpEl(): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'wp-marker'
  el.style.cssText =
    'width:26px;height:26px;border-radius:50%;display:grid;place-items:center;' +
    'font:600 12px var(--font-num);color:#04121a;cursor:grab;' +
    'border:2px solid #04121a;box-shadow:0 2px 6px rgba(0,0,0,.5);transition:box-shadow .15s;'
  return el
}

function makeLabelEl(): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText =
    'padding:2px 7px;border-radius:5px;font:600 10.5px var(--font-num);white-space:nowrap;' +
    'color:' + C.textHi + ';background:rgba(8,12,20,.82);border:1px solid ' + C.stroke + ';' +
    'transform:translateY(-1px);pointer-events:none;'
  return el
}

function makeHomeEl(): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText =
    'width:24px;height:24px;border-radius:6px 6px 6px 0;display:grid;place-items:center;' +
    'background:' + C.accent + ';border:2px solid #04121a;box-shadow:0 0 10px ' + C.accent + '99;' +
    'cursor:grab;transform:rotate(-45deg);'
  el.innerHTML = '<span style="transform:rotate(45deg);color:#04121a;font-size:12px;line-height:1">&#9873;</span>'
  return el
}

function rebuild(
  map: MlMap,
  wpMarkers: WpMarker[],
  labels: Marker[],
  homeMarkerRef: React.MutableRefObject<Marker | null>,
  draggingSeq: number | null,
  createWpMarker: () => WpMarker
): void {
  const { mission, selected, homeOverride } = useMission.getState()
  const waypoints = mission.waypoints
  const home = getEffectiveHome()
  const telHome = useVehicle.getState().frame.home

  // ---- 航点标记 reconcile ----
  while (wpMarkers.length < waypoints.length) wpMarkers.push(createWpMarker())
  while (wpMarkers.length > waypoints.length) wpMarkers.pop()!.remove()

  waypoints.forEach((w, i) => {
    const m = wpMarkers[i]
    m._seq = w.seq
    if (w.seq !== draggingSeq) m.setLngLat([w.lon, w.lat])
    const el = m.getElement()
    const sel = selected === w.seq
    el.style.background = sel ? C.accent : C.success
    el.style.boxShadow = sel ? `0 0 0 3px ${C.accent}66, 0 2px 6px rgba(0,0,0,.5)` : '0 2px 6px rgba(0,0,0,.5)'
    el.textContent = String(w.seq)
  })

  // ---- 手动起飞点标记：只在没有真实遥测 home、且用户已手动设置时显示 ----
  const showOverride = !telHome && !!homeOverride
  if (showOverride && !homeMarkerRef.current) {
    const el = makeHomeEl()
    const marker = new maplibregl.Marker({ element: el, draggable: true })
      .setLngLat([homeOverride!.lon, homeOverride!.lat])
      .addTo(map)
    marker.on('dragend', () => {
      const ll = marker.getLngLat()
      useMission.getState().setHomeOverride({ lat: ll.lat, lon: ll.lng })
    })
    homeMarkerRef.current = marker
  } else if (!showOverride && homeMarkerRef.current) {
    homeMarkerRef.current.remove()
    homeMarkerRef.current = null
  }
  if (showOverride && homeOverride) homeMarkerRef.current?.setLngLat([homeOverride.lon, homeOverride.lat])

  // ---- 航线折线 ----
  const pts: [number, number][] = []
  if (home && waypoints.length) pts.push([home.lon, home.lat])
  waypoints.forEach((w) => pts.push([w.lon, w.lat]))
  const { closed } = mission
  if (closed && waypoints.length > 1) pts.push([waypoints[0].lon, waypoints[0].lat])
  setLine(map, pts)

  // ---- 分段标签 (距离 | 速度 | 航向) ----
  const segs: { mid: [number, number]; text: string }[] = []
  const seq: { lat: number; lon: number; speed: number }[] = []
  if (home && waypoints.length) seq.push({ lat: home.lat, lon: home.lon, speed: waypoints[0].speed })
  waypoints.forEach((w) => seq.push({ lat: w.lat, lon: w.lon, speed: w.speed }))
  if (closed && waypoints.length > 1) {
    const w0 = waypoints[0]
    seq.push({ lat: w0.lat, lon: w0.lon, speed: w0.speed })
  }
  for (let i = 0; i < seq.length - 1; i++) {
    const a = seq[i]
    const b = seq[i + 1]
    const d = haversine(a, b)
    const brg = bearing(a, b)
    segs.push({
      mid: [(a.lon + b.lon) / 2, (a.lat + b.lat) / 2],
      text: `${d.toFixed(1)}m | ${b.speed.toFixed(1)}m/s | ${brg.toFixed(0)}°`
    })
  }
  while (labels.length < segs.length) {
    labels.push(new maplibregl.Marker({ element: makeLabelEl() }).setLngLat([0, 0]).addTo(map))
  }
  while (labels.length > segs.length) labels.pop()!.remove()
  segs.forEach((s, i) => {
    labels[i].setLngLat(s.mid)
    labels[i].getElement().textContent = s.text
  })
}

function setLine(map: MlMap, coords: [number, number][]): void {
  const src = map.getSource('mission') as maplibregl.GeoJSONSource | undefined
  src?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} })
}

/** 拖拽中实时更新折线（不写 store，避免历史污染 + 避免整店订阅把 marker 拽回旧坐标） */
function liveLine(map: MlMap, seq: number, lat: number, lon: number): void {
  const { mission } = useMission.getState()
  const waypoints = mission.waypoints
  const home = getEffectiveHome()
  const pts: [number, number][] = []
  if (home && waypoints.length) pts.push([home.lon, home.lat])
  waypoints.forEach((w) => pts.push(w.seq === seq ? [lon, lat] : [w.lon, w.lat]))
  if (mission.closed && waypoints.length > 1) {
    const w0 = waypoints[0]
    pts.push(w0.seq === seq ? [lon, lat] : [w0.lon, w0.lat])
  }
  setLine(map, pts)
}

function fitToMission(map: MlMap): void {
  const waypoints = useMission.getState().mission.waypoints
  const home = getEffectiveHome()
  const all: [number, number][] = waypoints.map((w) => [w.lon, w.lat])
  if (home) all.push([home.lon, home.lat])
  if (all.length === 0) return
  if (all.length === 1) {
    map.easeTo({ center: all[0], zoom: 17, duration: 400 })
    return
  }
  const b = new maplibregl.LngLatBounds(all[0], all[0])
  all.forEach((c) => b.extend(c))
  map.fitBounds(b, { padding: 120, duration: 500, maxZoom: 19 })
}
