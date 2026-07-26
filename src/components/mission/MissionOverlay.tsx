import { useEffect, useRef, useState } from 'react'
import maplibregl, { Marker } from 'maplibre-gl'
import type { Map as MlMap } from 'maplibre-gl'
import { useMapStore } from '../../state/mapStore'
import { useMission } from '../../state/missionStore'
import { useVehicle } from '../../state/vehicleStore'
import { haversine, bearing, type LL } from '../../util/geo'
import { getEffectiveHome, getEffectiveReturnPoint } from '../../util/effectiveHome'
import { toMapLngLat, fromMapLngLat } from '../../util/coordTransform'
import { C } from '../../theme/tokens'
import { WaypointContextMenu } from './WaypointContextMenu'
import { MapContextMenu } from './MapContextMenu'

interface WpMarker extends Marker {
  _seq?: number
}

const EMPTY: GeoJSON.Feature = {
  type: 'Feature',
  geometry: { type: 'LineString', coordinates: [] },
  properties: {}
}

/** 目标元素是否是可编辑输入控件——键盘快捷键在这些元素里应放行，交给浏览器原生编辑行为。 */
function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

export function MissionOverlay(): JSX.Element | null {
  const map = useMapStore((s) => s.map)
  const ready = useMapStore((s) => s.ready)
  const wpRef = useRef<WpMarker[]>([])
  const labelRef = useRef<Marker[]>([])
  const homeMarkerRef = useRef<Marker | null>(null)
  const returnMarkerRef = useRef<Marker | null>(null)
  const draggingSeq = useRef<number | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ seq: number; x: number; y: number } | null>(null)
  const [mapCtx, setMapCtx] = useState<{ lat: number; lon: number; x: number; y: number } | null>(null)

  // 供地图 effect 里的 Esc 处理读取"当前是否有右键菜单打开"，而不必把 ctxMenu/mapCtx
  // 放进 effect 依赖数组（那样每次开关菜单都要重新绑定一遍地图事件，成本不必要地高）。
  const ctxMenuOpenRef = useRef(false)
  const mapCtxOpenRef = useRef(false)
  ctxMenuOpenRef.current = ctxMenu != null
  mapCtxOpenRef.current = mapCtx != null

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
        const ll = fromMapLngLat(marker.getLngLat().lat, marker.getLngLat().lng)
        if (marker._seq) liveLine(map, marker._seq, ll.lat, ll.lon)
      })
      marker.on('dragend', () => {
        el.style.cursor = 'grab'
        const ll = fromMapLngLat(marker.getLngLat().lat, marker.getLngLat().lng)
        const seq = marker._seq
        draggingSeq.current = null
        if (seq) {
          useMission.getState().moveWaypoint(seq, ll.lat, ll.lon)
          // MapLibre 在检测到拖拽位移后会吞掉随之而来的 click，这里兜底确保拖完即选中，
          // 单航点编辑面板才能可靠弹出。
          useMission.getState().select(seq)
        }
      })
      return marker
    }

    const render = (): void =>
      rebuild(map, wpRef.current, labelRef.current, homeMarkerRef, returnMarkerRef, draggingSeq.current, createWpMarker)

    const unsubM = useMission.subscribe(render)
    const unsubV = useVehicle.subscribe((s, p) => {
      if (s.frame.home !== p.frame.home) render()
    })

    const onClick = (e: maplibregl.MapMouseEvent): void => {
      const st = useMission.getState()
      const ll = fromMapLngLat(e.lngLat.lat, e.lngLat.lng)
      if (st.setHomeMode) {
        st.setHomeOverride(ll)
        return
      }
      if (st.setReturnMode) {
        st.setReturnCustom(ll)
        return
      }
      if (st.addMode) st.addWaypoint(ll.lat, ll.lon)
    }
    const onContext = (e: maplibregl.MapMouseEvent): void => {
      // 航点/起飞点/返航点 marker 自己的 contextmenu 监听会 stopPropagation，
      // 冒泡到这里的只会是"点在地图空白处"的情况。
      e.originalEvent.preventDefault()
      const ll = fromMapLngLat(e.lngLat.lat, e.lngLat.lng)
      setMapCtx({ lat: ll.lat, lon: ll.lon, x: e.originalEvent.clientX, y: e.originalEvent.clientY })
    }
    const onFit = (): void => fitToMission(map)
    map.on('click', onClick)
    map.on('contextmenu', onContext)
    window.addEventListener('mission-fit', onFit)
    render()

    // 键盘快捷键：Ctrl/Cmd+Z 撤销、Ctrl/Cmd+Shift+Z 或 Ctrl/Cmd+Y 重做、
    // Delete/Backspace 删除选中航点、Esc 退出当前落点模式/关闭菜单/取消选中。
    const onKeyDown = (e: KeyboardEvent): void => {
      if (isEditableTarget(e.target)) return
      const st = useMission.getState()
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) st.redo()
        else st.undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        st.redo()
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && typeof st.selected === 'number') {
        e.preventDefault()
        st.deleteWaypoint(st.selected)
        return
      }
      if (e.key === 'Escape') {
        if (ctxMenuOpenRef.current || mapCtxOpenRef.current) return // 交给菜单自己的 Esc 监听关闭
        if (st.addMode) st.setAddMode(false)
        else if (st.setHomeMode) st.toggleSetHomeMode(false)
        else if (st.setReturnMode) st.toggleSetReturnMode(false)
        else if (st.selected != null) st.select(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      unsubM()
      unsubV()
      window.removeEventListener('mission-fit', onFit)
      window.removeEventListener('keydown', onKeyDown)
      wpRef.current.forEach((m) => m.remove())
      labelRef.current.forEach((m) => m.remove())
      homeMarkerRef.current?.remove()
      returnMarkerRef.current?.remove()
      wpRef.current = []
      labelRef.current = []
      homeMarkerRef.current = null
      returnMarkerRef.current = null
      // sibling 组件（FlightMap）可能已先执行 map.remove()，此时地图内部状态已销毁，
      // 后续调用会抛异常；这里静默降级，避免路由切换期间的竞态把渲染树打崩（黑屏/卡死）。
      try {
        map.off('click', onClick)
        map.off('contextmenu', onContext)
        for (const id of ['mission-line', 'mission-glow']) if (map.getLayer(id)) map.removeLayer(id)
        if (map.getSource('mission')) map.removeSource('mission')
      } catch {
        /* map 已被销毁，无需清理 */
      }
    }
  }, [map, ready])

  return (
    <>
      {ctxMenu && <WaypointContextMenu seq={ctxMenu.seq} x={ctxMenu.x} y={ctxMenu.y} onClose={() => setCtxMenu(null)} />}
      {mapCtx && (
        <MapContextMenu lat={mapCtx.lat} lon={mapCtx.lon} x={mapCtx.x} y={mapCtx.y} onClose={() => setMapCtx(null)} />
      )}
    </>
  )
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

function makeReturnEl(): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText =
    'width:22px;height:22px;border-radius:50%;display:grid;place-items:center;' +
    'background:' + C.primary + ';border:2px solid #04121a;box-shadow:0 0 10px ' + C.primary + '99;cursor:grab;'
  el.innerHTML = '<span style="color:#04121a;font-size:10.5px;font-weight:700;line-height:1">R</span>'
  return el
}

function rebuild(
  map: MlMap,
  wpMarkers: WpMarker[],
  labels: Marker[],
  homeMarkerRef: React.MutableRefObject<Marker | null>,
  returnMarkerRef: React.MutableRefObject<Marker | null>,
  draggingSeq: number | null,
  createWpMarker: () => WpMarker
): void {
  const { mission, selected, homeOverride } = useMission.getState()
  const waypoints = mission.waypoints
  const home = getEffectiveHome()
  const returnPt = getEffectiveReturnPoint()
  const telHome = useVehicle.getState().frame.home
  const returnDiffers = mission.returnPointMode !== 'home'

  // ---- 航点标记 reconcile ----
  while (wpMarkers.length < waypoints.length) wpMarkers.push(createWpMarker())
  while (wpMarkers.length > waypoints.length) wpMarkers.pop()!.remove()

  waypoints.forEach((w, i) => {
    const m = wpMarkers[i]
    m._seq = w.seq
    if (w.seq !== draggingSeq) m.setLngLat(toMapLngLat(w))
    const el = m.getElement()
    const sel = selected === w.seq
    const isReturnRef = mission.returnPointMode === 'waypoint' && mission.returnWaypointSeq === w.seq
    el.style.background = sel ? C.accent : C.success
    el.style.boxShadow = sel
      ? `0 0 0 3px ${C.accent}66, 0 2px 6px rgba(0,0,0,.5)`
      : isReturnRef
        ? `0 0 0 3px ${C.primary}88, 0 2px 6px rgba(0,0,0,.5)`
        : '0 2px 6px rgba(0,0,0,.5)'
    el.textContent = String(w.seq)
  })

  // ---- 手动起飞点标记：只在没有真实遥测 home、且用户已手动设置时显示 ----
  const showHomeOverride = !telHome && !!homeOverride
  if (showHomeOverride && !homeMarkerRef.current) {
    const el = makeHomeEl()
    const marker = new maplibregl.Marker({ element: el, draggable: true })
      .setLngLat(toMapLngLat(homeOverride!))
      .addTo(map)
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      useMission.getState().select('home')
    })
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      e.stopPropagation()
      useMission.getState().select('home')
    })
    marker.on('dragend', () => {
      useMission.getState().setHomeOverride(fromMapLngLat(marker.getLngLat().lat, marker.getLngLat().lng))
    })
    homeMarkerRef.current = marker
  } else if (!showHomeOverride && homeMarkerRef.current) {
    homeMarkerRef.current.remove()
    homeMarkerRef.current = null
  }
  if (showHomeOverride && homeOverride) homeMarkerRef.current?.setLngLat(toMapLngLat(homeOverride))

  // ---- 自定义返航点标记：仅 returnPointMode==='custom' 时单独画一个点 ----
  const showReturnMarker = mission.returnPointMode === 'custom' && mission.returnLat != null && mission.returnLon != null
  if (showReturnMarker && !returnMarkerRef.current) {
    const el = makeReturnEl()
    const marker = new maplibregl.Marker({ element: el, draggable: true })
      .setLngLat(toMapLngLat({ lat: mission.returnLat!, lon: mission.returnLon! }))
      .addTo(map)
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      useMission.getState().select('return')
    })
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      e.stopPropagation()
      useMission.getState().select('return')
    })
    marker.on('dragend', () => {
      useMission.getState().setReturnCustom(fromMapLngLat(marker.getLngLat().lat, marker.getLngLat().lng))
    })
    returnMarkerRef.current = marker
  } else if (!showReturnMarker && returnMarkerRef.current) {
    returnMarkerRef.current.remove()
    returnMarkerRef.current = null
  }
  if (showReturnMarker) returnMarkerRef.current?.setLngLat(toMapLngLat({ lat: mission.returnLat!, lon: mission.returnLon! }))

  // ---- 航线折线 ----
  // 注意：这里全程用 WGS84 参与距离/方位角计算（haversine/bearing 需要真实坐标才准确），
  // 只在最终喂给 MapLibre 的 setLine/setLngLat 里转换成当前底图坐标系，见 setLine() 实现。
  const pts: LL[] = []
  if (home && waypoints.length) pts.push(home)
  waypoints.forEach((w) => pts.push({ lat: w.lat, lon: w.lon }))
  const { closed } = mission
  if (closed && waypoints.length > 1) pts.push({ lat: waypoints[0].lat, lon: waypoints[0].lon })
  else if (returnDiffers && returnPt && waypoints.length) pts.push(returnPt)
  setLine(map, pts)

  // ---- 分段标签 (距离 | 速度 | 航向) ----
  const segs: { mid: LL; text: string }[] = []
  const seq: { lat: number; lon: number; speed: number }[] = []
  if (home && waypoints.length) seq.push({ lat: home.lat, lon: home.lon, speed: waypoints[0].speed })
  waypoints.forEach((w) => seq.push({ lat: w.lat, lon: w.lon, speed: w.speed }))
  if (closed && waypoints.length > 1) {
    const w0 = waypoints[0]
    seq.push({ lat: w0.lat, lon: w0.lon, speed: w0.speed })
  } else if (returnDiffers && returnPt && waypoints.length) {
    seq.push({ lat: returnPt.lat, lon: returnPt.lon, speed: mission.returnSpeed })
  }
  for (let i = 0; i < seq.length - 1; i++) {
    const a = seq[i]
    const b = seq[i + 1]
    const d = haversine(a, b)
    const brg = bearing(a, b)
    segs.push({
      mid: { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 },
      text: `${d.toFixed(1)}m | ${b.speed.toFixed(1)}m/s | ${brg.toFixed(0)}°`
    })
  }
  while (labels.length < segs.length) {
    labels.push(new maplibregl.Marker({ element: makeLabelEl() }).setLngLat([0, 0]).addTo(map))
  }
  while (labels.length > segs.length) labels.pop()!.remove()
  segs.forEach((s, i) => {
    labels[i].setLngLat(toMapLngLat(s.mid))
    labels[i].getElement().textContent = s.text
  })
}

/** 写航线折线：入参始终是 WGS84，这里统一转换到当前底图坐标系再喂给 MapLibre。 */
function setLine(map: MlMap, coords: LL[]): void {
  const src = map.getSource('mission') as maplibregl.GeoJSONSource | undefined
  src?.setData({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords.map(toMapLngLat) },
    properties: {}
  })
}

/** 拖拽中实时更新折线（不写 store，避免历史污染 + 避免整店订阅把 marker 拽回旧坐标）。lat/lon 是 WGS84。 */
function liveLine(map: MlMap, seq: number, lat: number, lon: number): void {
  const { mission } = useMission.getState()
  const waypoints = mission.waypoints
  const home = getEffectiveHome()
  const returnPt = getEffectiveReturnPoint()
  const dragged: LL = { lat, lon }
  const pts: LL[] = []
  if (home && waypoints.length) pts.push(home)
  waypoints.forEach((w) => pts.push(w.seq === seq ? dragged : { lat: w.lat, lon: w.lon }))
  if (mission.closed && waypoints.length > 1) {
    const w0 = waypoints[0]
    pts.push(w0.seq === seq ? dragged : { lat: w0.lat, lon: w0.lon })
  } else if (mission.returnPointMode !== 'home' && returnPt && waypoints.length) {
    pts.push(mission.returnPointMode === 'waypoint' && mission.returnWaypointSeq === seq ? dragged : returnPt)
  }
  setLine(map, pts)
}

function fitToMission(map: MlMap): void {
  const waypoints = useMission.getState().mission.waypoints
  const home = getEffectiveHome()
  const returnPt = getEffectiveReturnPoint()
  const wgs: LL[] = waypoints.map((w) => ({ lat: w.lat, lon: w.lon }))
  if (home) wgs.push(home)
  if (returnPt && (returnPt.lat !== home?.lat || returnPt.lon !== home?.lon)) wgs.push(returnPt)
  if (wgs.length === 0) return
  const all = wgs.map(toMapLngLat)
  if (all.length === 1) {
    map.easeTo({ center: all[0], zoom: 17, duration: 400 })
    return
  }
  const b = new maplibregl.LngLatBounds(all[0], all[0])
  all.forEach((c) => b.extend(c))
  map.fitBounds(b, { padding: 120, duration: 500, maxZoom: 19 })
}
