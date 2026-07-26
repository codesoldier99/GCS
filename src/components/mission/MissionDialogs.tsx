import { useEffect, useMemo, useState } from 'react'
import { useMission } from '../../state/missionStore'
import { useVehicle } from '../../state/vehicleStore'
import { useMapStore } from '../../state/mapStore'
import { destination, bearing, type LL } from '../../util/geo'
import { useEffectiveHome, getEffectiveReturnPoint } from '../../util/effectiveHome'
import {
  boustrophedonTemplate,
  circleTemplate,
  starTemplate,
  type Corner,
  type TemplateCommon
} from '../../util/missionTemplates'
import { TURN_OPTS } from '../../util/missionEnums'
import { LIMITS } from '../../util/limits'
import type { TurnMode, Waypoint } from '@shared/mission'
import { Dialog, Field, NumberInput, Select, fieldStyles } from './fields'
import { FloatingPanel } from './FloatingPanel'
import { Icon } from '../Icon'

/** 弹窗调度器：按 store.dialog 渲染对应工具 */
export function MissionDialogs(): JSX.Element | null {
  const dialog = useMission((s) => s.dialog)
  const close = () => useMission.getState().openDialog('none')
  if (dialog === 'none') return null
  return (
    <>
      {dialog === 'relcoord' && <RelativeCoordDialog onClose={close} />}
      {dialog === 'transform' && <TransformDialog onClose={close} />}
      {dialog === 'template' && <TemplateDialog onClose={close} />}
      {dialog === 'list' && <WaypointListDialog onClose={close} />}
      <style>{fieldStyles}</style>
    </>
  )
}

/** 参考基点选项（起飞点 + 各航点），返回 LL */
function useBaseOptions(): { opts: { value: string; label: string }[]; resolve: (v: string) => LL } {
  const waypoints = useMission((s) => s.mission.waypoints)
  const home = useEffectiveHome()
  const map = useMapStore((s) => s.map)
  const opts: { value: string; label: string }[] = []
  if (home) opts.push({ value: 'home', label: '起飞点' })
  opts.push({ value: 'center', label: '地图中心' })
  waypoints.forEach((w) => opts.push({ value: `wp${w.seq}`, label: `航点 ${w.seq}` }))
  const resolve = (v: string): LL => {
    if (v === 'home' && home) return home
    if (v.startsWith('wp')) {
      const w = waypoints.find((x) => x.seq === +v.slice(2))
      if (w) return { lat: w.lat, lon: w.lon }
    }
    const c = map?.getCenter()
    return c ? { lat: c.lat, lon: c.lng } : { lat: 22.889482, lon: 113.400647 }
  }
  return { opts, resolve }
}

/** 某基准点的"进入方向"（其前一点 → 它自身的方位角），用于夹角模式；无参照点时返回 null。 */
function referenceBearing(baseValue: string, waypoints: Waypoint[], home: LL | null): number | null {
  if (!baseValue.startsWith('wp')) return null
  const n = +baseValue.slice(2)
  const idx = waypoints.findIndex((w) => w.seq === n)
  if (idx < 0) return null
  const prev = idx > 0 ? waypoints[idx - 1] : home
  if (!prev) return null
  return bearing(prev, waypoints[idx])
}

function mkWaypoint(p: LL, c: TemplateCommon, heading = 0): Waypoint {
  return { seq: 0, lat: p.lat, lon: p.lon, alt: c.alt, speed: c.speed, turnMode: c.turnMode, hoverTime: c.hoverTime, heading }
}

// ---------------- 相对坐标编辑器 ----------------
function RelativeCoordDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const { opts, resolve } = useBaseOptions()
  const waypoints = useMission((s) => s.mission.waypoints)
  const home = useEffectiveHome()
  const replace = useMission((s) => s.replaceWaypoints)
  const pendingBase = useMission((s) => s.pendingBase)
  const setPendingBase = useMission((s) => s.setPendingBase)

  const [base, setBase] = useState(pendingBase ?? opts[0]?.value ?? 'center')
  const [angleMode, setAngleMode] = useState<'azimuth' | 'interior'>('azimuth')
  const [azimuth, setAzimuth] = useState(60)
  const [interior, setInterior] = useState(0)
  const [dist, setDist] = useState(100)
  const [alt, setAlt] = useState(30)
  const [speed, setSpeed] = useState(8)
  const [mode, setMode] = useState<'insert' | 'append'>('append')

  useEffect(() => {
    if (pendingBase) setPendingBase(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refBearing = referenceBearing(base, waypoints, home)
  const finalAzimuth =
    angleMode === 'interior' && refBearing != null ? (refBearing + interior + 360) % 360 : azimuth

  const add = (): void => {
    const p = destination(resolve(base), finalAzimuth, dist)
    const wp = mkWaypoint(p, { alt, speed, turnMode: 'stop', hoverTime: 0 }, finalAzimuth)
    if (mode === 'append' || !base.startsWith('wp')) {
      replace([...waypoints, wp], 'replace')
    } else {
      const idx = waypoints.findIndex((w) => w.seq === +base.slice(2))
      const arr = [...waypoints]
      arr.splice(idx + 1, 0, wp)
      replace(arr, 'replace')
    }
    onClose()
  }

  return (
    <FloatingPanel
      title="相对坐标编辑器"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn primary" onClick={add}><Icon name="plus" size={15} /> 添加</button>
        </>
      }
    >
      <div style={{ fontSize: 12.5, color: 'var(--text-mid)', marginBottom: 12 }}>
        通过相对坐标绘制航点：以基准点为起点，按角度与相对距离生成新航点。
      </div>
      <Field label="基准点">
        <Select value={base} onChange={setBase} options={opts} />
      </Field>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <button
          className="btn"
          style={{ flex: 1, background: angleMode === 'azimuth' ? 'var(--primary-dim)' : 'var(--bg-2)', borderColor: angleMode === 'azimuth' ? 'var(--primary)' : 'var(--stroke)' }}
          onClick={() => setAngleMode('azimuth')}
        >
          方位角
        </button>
        <button
          className="btn"
          style={{ flex: 1, background: angleMode === 'interior' ? 'var(--primary-dim)' : 'var(--bg-2)', borderColor: angleMode === 'interior' ? 'var(--primary)' : 'var(--stroke)' }}
          onClick={() => setAngleMode('interior')}
        >
          夹角
        </button>
      </div>
      {angleMode === 'azimuth' ? (
        <Field label="方位角（正北为0，顺时针）">
          <NumberInput value={azimuth} step={1} unit="°" onChange={setAzimuth} />
        </Field>
      ) : refBearing != null ? (
        <Field label="夹角（相对来向，顺时针为正）" hint={`来向方位角 ${refBearing.toFixed(0)}° · 最终方位角 ${finalAzimuth.toFixed(0)}°`}>
          <NumberInput value={interior} step={1} unit="°" onChange={setInterior} />
        </Field>
      ) : (
        <Field label="夹角" hint="该基准点无参照来向（首点/地图中心/起飞点），已回退为方位角模式">
          <NumberInput value={azimuth} step={1} unit="°" onChange={setAzimuth} />
        </Field>
      )}
      <Field label="相对距离">
        <NumberInput value={dist} step={1} unit="m" onChange={setDist} />
      </Field>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><Field label="高度"><NumberInput value={alt} step={1} min={LIMITS.altMin} max={LIMITS.altMax} unit="m" onChange={setAlt} /></Field></div>
        <div style={{ flex: 1 }}><Field label="速度"><NumberInput value={speed} step={0.5} min={LIMITS.speedMin} max={LIMITS.speedMax} unit="m/s" onChange={setSpeed} /></Field></div>
      </div>
      <Field label="生成方式">
        <Select
          value={mode}
          onChange={setMode}
          options={[
            { value: 'append', label: '追加到末尾' },
            { value: 'insert', label: '插入到基准点之后' }
          ]}
        />
      </Field>
    </FloatingPanel>
  )
}

// ---------------- 航线变换（旋转/平移/反序） ----------------
function TransformDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const { opts, resolve } = useBaseOptions()
  const rotate = useMission((s) => s.rotate)
  const translate = useMission((s) => s.translate)
  const reverse = useMission((s) => s.reverse)
  const [base, setBase] = useState(opts[0]?.value ?? 'center')
  const [angle, setAngle] = useState(0)
  const [north, setNorth] = useState(0)
  const [east, setEast] = useState(0)

  return (
    <FloatingPanel title="航线变换" onClose={onClose} width={340}>
      <div className="label" style={{ color: 'var(--primary)', marginBottom: 8 }}>旋转工具</div>
      <Field label="旋转基点">
        <Select value={base} onChange={setBase} options={opts} />
      </Field>
      <Field label="延北夹角（顺时针为正）">
        <NumberInput value={angle} step={1} unit="°" onChange={setAngle} />
      </Field>
      <button className="btn primary" style={{ width: '100%', marginBottom: 16 }} onClick={() => { rotate(resolve(base), angle); onClose() }}>
        <Icon name="compass" size={15} /> 旋转
      </button>

      <div className="label" style={{ color: 'var(--primary)', marginBottom: 8 }}>平移工具</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><Field label="向北"><NumberInput value={north} step={1} unit="m" onChange={setNorth} /></Field></div>
        <div style={{ flex: 1 }}><Field label="向东"><NumberInput value={east} step={1} unit="m" onChange={setEast} /></Field></div>
      </div>
      <button className="btn primary" style={{ width: '100%', marginBottom: 16 }} onClick={() => { translate(north, east); onClose() }}>
        <Icon name="follow" size={15} /> 平移
      </button>

      <div className="label" style={{ color: 'var(--primary)', marginBottom: 8 }}>航点反序</div>
      <button className="btn" style={{ width: '100%' }} onClick={() => { reverse(); onClose() }}>
        <Icon name="reverse" size={15} /> 反序（首尾颠倒）
      </button>
    </FloatingPanel>
  )
}

// ---------------- 航线模板（圆形/弓形/星形） ----------------
type TplKind = 'circle' | 'boustrophedon' | 'star'
type TplBaseMode = 'home' | 'last' | 'center'

function TemplateDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const { resolve } = useBaseOptions()
  const home = useEffectiveHome()
  const map = useMapStore((s) => s.map)
  const waypoints = useMission((s) => s.mission.waypoints)
  const replace = useMission((s) => s.replaceWaypoints)
  const setTemplatePreview = useMapStore((s) => s.setTemplatePreview)
  const lastWp = waypoints[waypoints.length - 1]

  const [kind, setKind] = useState<TplKind>('boustrophedon')
  const [baseMode, setBaseMode] = useState<TplBaseMode>(lastWp ? 'last' : 'home')
  const [alt, setAlt] = useState(50)
  const [speed, setSpeed] = useState(5)
  const [hover, setHover] = useState(1)
  const [turn, setTurn] = useState<TurnMode>('stop')
  const [count, setCount] = useState(12)
  const [radius, setRadius] = useState(80)
  const [length, setLength] = useState(100)
  const [width, setWidth] = useState(60)
  const [heading, setHeading] = useState(0)
  const [corner, setCorner] = useState<Corner>('tl')
  const [genMode, setGenMode] = useState<'replace' | 'append'>(lastWp ? 'append' : 'replace')

  const base = useMemo<LL>(() => {
    if (baseMode === 'last' && lastWp) return { lat: lastWp.lat, lon: lastWp.lon }
    if (baseMode === 'home' && home) return home
    if (baseMode === 'center') {
      const c = map?.getCenter()
      if (c) return { lat: c.lat, lon: c.lng }
    }
    return home ?? resolve('center')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseMode, home, lastWp, map])

  const common: TemplateCommon = { alt, speed, turnMode: turn, hoverTime: hover }
  const preview = useMemo<Waypoint[]>(() => {
    if (kind === 'circle') return circleTemplate(base, radius, count, heading, common)
    if (kind === 'star') return starTemplate(base, radius, Math.max(3, Math.round(count / 2)), heading, common)
    return boustrophedonTemplate(base, length, width, count, corner, heading, common)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, base, radius, count, length, width, heading, corner, alt, speed, hover, turn])

  // 在真实地图上实时叠加预览，供确认后再生成（而非只看小画布）
  useEffect(() => {
    setTemplatePreview(preview.map((w) => ({ lat: w.lat, lon: w.lon })))
    return () => setTemplatePreview(null)
  }, [preview, setTemplatePreview])

  return (
    <FloatingPanel
      title="航线模板"
      onClose={onClose}
      width={400}
      footer={
        <>
          <button className="btn" onClick={onClose}>取消</button>
          <button
            className="btn primary"
            onClick={() => {
              replace(preview, genMode)
              window.dispatchEvent(new Event('mission-fit'))
              onClose()
            }}
          >
            <Icon name="plus" size={15} /> 生成（{preview.length} 点）
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {([['circle', '圆形'], ['boustrophedon', '弓形'], ['star', '星形']] as [TplKind, string][]).map(([k, l]) => (
          <button
            key={k}
            className="btn"
            style={{
              flex: 1,
              background: kind === k ? 'var(--primary-dim)' : 'var(--bg-2)',
              borderColor: kind === k ? 'var(--primary)' : 'var(--stroke)',
              color: kind === k ? 'var(--primary)' : 'var(--text-mid)'
            }}
            onClick={() => setKind(k)}
          >
            {l}
          </button>
        ))}
      </div>

      <Field label="基准点">
        <Select
          value={baseMode}
          onChange={setBaseMode}
          options={[
            { value: 'home', label: '起飞点', disabled: !home },
            { value: 'last', label: '最后航点（续接航线）', disabled: !lastWp },
            { value: 'center', label: '地图中心' }
          ]}
        />
      </Field>

      <div style={{ display: 'flex', gap: 14 }}>
        <div style={{ flex: 1 }}>
          {kind !== 'boustrophedon' && (
            <Field label="半径"><NumberInput value={radius} step={5} unit="m" onChange={setRadius} /></Field>
          )}
          {kind === 'boustrophedon' && (
            <>
              <Field label="边长（单程）"><NumberInput value={length} step={5} unit="m" onChange={setLength} /></Field>
              <Field label="宽度（总）"><NumberInput value={width} step={5} unit="m" onChange={setWidth} /></Field>
              <Field label="开始位置">
                <Select
                  value={corner}
                  onChange={setCorner}
                  options={[
                    { value: 'tl', label: '左上' },
                    { value: 'tr', label: '右上' },
                    { value: 'bl', label: '左下' },
                    { value: 'br', label: '右下' }
                  ]}
                />
              </Field>
            </>
          )}
          <Field label={kind === 'star' ? '角点数 ×2' : '航点数量'}>
            <NumberInput value={count} step={1} min={3} max={LIMITS.templateCountMax} onChange={setCount} />
          </Field>
          <Field label="航向 / 起始角"><NumberInput value={heading} step={1} unit="°" onChange={setHeading} /></Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="高度"><NumberInput value={alt} step={1} min={LIMITS.altMin} max={LIMITS.altMax} unit="m" onChange={setAlt} /></Field>
          <Field label="水平速度"><NumberInput value={speed} step={0.5} min={LIMITS.speedMin} max={LIMITS.speedMax} unit="m/s" onChange={setSpeed} /></Field>
          <Field label="悬停时间"><NumberInput value={hover} step={1} min={LIMITS.hoverMin} max={LIMITS.hoverMax} unit="s" onChange={setHover} /></Field>
          <Field label="转弯模式"><Select value={turn} onChange={setTurn} options={TURN_OPTS} /></Field>
        </div>
      </div>

      <TemplatePreview base={base} wps={preview} />

      <Field label="生成方式">
        <Select
          value={genMode}
          onChange={setGenMode}
          options={[
            { value: 'replace', label: '覆盖现有航点' },
            { value: 'append', label: '追加到末尾' }
          ]}
        />
      </Field>
    </FloatingPanel>
  )
}

function TemplatePreview({ base, wps }: { base: LL; wps: Waypoint[] }): JSX.Element {
  const S = 150
  const pad = 14
  const pts = wps.map((w) => {
    // 简易等距投影到米
    const e = (w.lon - base.lon) * 111320 * Math.cos((base.lat * Math.PI) / 180)
    const n = (w.lat - base.lat) * 111320
    return { e, n }
  })
  const xs = pts.map((p) => p.e)
  const ys = pts.map((p) => p.n)
  const minX = Math.min(-1, ...xs), maxX = Math.max(1, ...xs)
  const minY = Math.min(-1, ...ys), maxY = Math.max(1, ...ys)
  const span = Math.max(maxX - minX, maxY - minY) || 1
  const proj = (p: { e: number; n: number }) => ({
    x: pad + ((p.e - minX) / span) * (S - 2 * pad),
    y: S - pad - ((p.n - minY) / span) * (S - 2 * pad)
  })
  const path = pts.map(proj).map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  return (
    <div style={{ display: 'grid', placeItems: 'center', margin: '6px 0 12px' }}>
      <svg width={S} height={S} style={{ background: 'var(--bg-0)', borderRadius: 8, border: '1px solid var(--stroke)' }}>
        <path d={path} fill="none" stroke="var(--success)" strokeWidth={1.6} strokeLinejoin="round" />
        {pts.map(proj).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.6} fill={i === 0 ? 'var(--accent)' : 'var(--success)'} />
        ))}
      </svg>
    </div>
  )
}

// ---------------- 航点列表（含拖拽重排/参数展示） + 上传下载 ----------------
function WaypointListDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const [tab, setTab] = useState<'list' | 'transfer'>('list')
  return (
    <Dialog title="航点列表 / 上传下载" onClose={onClose} width={400}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <button
          className="btn"
          style={{ flex: 1, background: tab === 'list' ? 'var(--primary-dim)' : 'var(--bg-2)', borderColor: tab === 'list' ? 'var(--primary)' : 'var(--stroke)' }}
          onClick={() => setTab('list')}
        >
          航点列表
        </button>
        <button
          className="btn"
          style={{ flex: 1, background: tab === 'transfer' ? 'var(--primary-dim)' : 'var(--bg-2)', borderColor: tab === 'transfer' ? 'var(--primary)' : 'var(--stroke)' }}
          onClick={() => setTab('transfer')}
        >
          上传 / 下载
        </button>
      </div>
      {tab === 'list' ? <WaypointListTab onClose={onClose} /> : <TransferTab />}
    </Dialog>
  )
}

function WaypointListTab({ onClose }: { onClose: () => void }): JSX.Element {
  const waypoints = useMission((s) => s.mission.waypoints)
  const selected = useMission((s) => s.selected)
  const select = useMission((s) => s.select)
  const deleteWaypoint = useMission((s) => s.deleteWaypoint)
  const reorder = useMission((s) => s.reorder)
  const [drag, setDrag] = useState<number | null>(null)

  if (waypoints.length === 0) {
    return <div style={{ color: 'var(--text-lo)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>暂无航点</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {waypoints.map((w, i) => (
        <div
          key={w.seq}
          draggable
          onDragStart={() => setDrag(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => { if (drag != null && drag !== i) reorder(drag, i); setDrag(null) }}
          onClick={() => select(w.seq)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 12px',
            borderRadius: 8,
            border: `1px solid ${selected === w.seq ? 'var(--primary)' : 'var(--stroke)'}`,
            background: drag === i ? 'var(--primary-dim)' : selected === w.seq ? 'rgba(23,212,230,0.08)' : 'var(--bg-2)',
            cursor: 'grab'
          }}
        >
          <Icon name="grip" size={16} style={{ color: 'var(--text-lo)' }} />
          <span style={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center',
            background: 'var(--success)', color: '#04121a', font: '600 12px var(--font-num)', flexShrink: 0 }}>{w.seq}</span>
          <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-mid)' }}>
            高度 {w.alt}m · 速度 {w.speed}m/s · {{ stop: '悬停转弯', coordinated: '协调转弯', adaptive: '自适应转弯' }[w.turnMode]} · 悬停 {w.hoverTime}s
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="icon-btn" style={{ width: 26, height: 26 }} disabled={i === 0} onClick={(e) => { e.stopPropagation(); reorder(i, i - 1) }}>
              <Icon name="chevron-left" size={14} style={{ transform: 'rotate(90deg)' }} />
            </button>
            <button className="icon-btn" style={{ width: 26, height: 26 }} disabled={i === waypoints.length - 1} onClick={(e) => { e.stopPropagation(); reorder(i, i + 1) }}>
              <Icon name="chevron-left" size={14} style={{ transform: 'rotate(-90deg)' }} />
            </button>
            <button
              className="icon-btn"
              style={{ width: 26, height: 26, color: 'var(--danger)', borderColor: 'var(--danger)' }}
              onClick={(e) => { e.stopPropagation(); deleteWaypoint(w.seq) }}
            >
              <Icon name="trash" size={13} />
            </button>
          </div>
        </div>
      ))}
      <button className="btn" style={{ marginTop: 4 }} onClick={onClose}>关闭</button>
    </div>
  )
}

function TransferTab(): JSX.Element {
  const mission = useMission((s) => s.mission)
  const loadMission = useMission((s) => s.loadMission)
  const connected = useVehicle((s) => s.frame.connected)
  const [busy, setBusy] = useState<null | string>(null)
  const [prog, setProg] = useState<{ c: number; t: number } | null>(null)
  const [msg, setMsg] = useState('')

  const upload = async (): Promise<void> => {
    if (mission.waypoints.length === 0) { setMsg('没有航点可上传'); return }
    setBusy('upload'); setMsg('')
    const off = window.gcs.onMissionProgress((p) => setProg({ c: p.current, t: p.total }))
    try {
      // 返航点若与起飞点不同（自定义坐标 / 与某航点重合），把解析好的绝对坐标一起传给主进程；
      // 主进程侧不知道"哪个航点是返航点"这类规划语义，只需要一个最终坐标。
      const returnPt = mission.returnPointMode !== 'home' ? getEffectiveReturnPoint() : null
      const r = await window.gcs.uploadMission(mission.waypoints, {
        finishAction: mission.finishAction,
        closed: mission.closed,
        returnAlt: mission.returnAlt,
        loopCount: mission.loopCount,
        infiniteLoop: mission.infiniteLoop,
        returnLat: returnPt?.lat ?? null,
        returnLon: returnPt?.lon ?? null
      })
      setMsg(r.error ? `上传失败：${r.error}` : `上传成功（${r.total} 项）`)
    } catch (e) {
      setMsg('上传失败：' + (e instanceof Error ? e.message : String(e)))
    } finally {
      off(); setBusy(null); setProg(null)
    }
  }

  const download = async (): Promise<void> => {
    setBusy('download'); setMsg('')
    try {
      const wps = await window.gcs.downloadMission()
      loadMission({ ...mission, waypoints: wps.map((w, i) => ({ ...w, seq: i + 1 })) })
      setMsg(wps.length ? `下载成功（${wps.length} 个航点）` : '飞控中无航点')
      window.dispatchEvent(new Event('mission-fit'))
    } catch (e) {
      setMsg('下载失败：' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="panel" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="route" size={20} style={{ color: 'var(--primary)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{mission.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-lo)' }}>
              {mission.waypoints.length} 个航点 · 完成动作：{{ hover: '悬停', rtl: '返航', land: '降落', hoverHome: '返回起飞点悬停' }[mission.finishAction]}
            </div>
          </div>
        </div>
      </div>

      {!connected && (
        <div style={{ fontSize: 12.5, color: 'var(--accent)', marginBottom: 12 }}>
          未连接飞控/仿真，上传下载不可用。
        </div>
      )}

      {prog && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
            <div style={{ width: `${(prog.c / Math.max(1, prog.t)) * 100}%`, height: '100%', background: 'var(--primary)', transition: 'width .1s' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-lo)', marginTop: 4 }}>{prog.c}/{prog.t}</div>
        </div>
      )}

      {msg && <div style={{ fontSize: 12.5, color: 'var(--text-mid)', marginBottom: 12 }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn primary" style={{ flex: 1 }} disabled={!connected || !!busy} onClick={upload}>
          <Icon name="upload" size={16} /> 上传航点
        </button>
        <button className="btn" style={{ flex: 1 }} disabled={!connected || !!busy} onClick={download}>
          <Icon name="download" size={16} /> 下载航点
        </button>
      </div>
    </>
  )
}
