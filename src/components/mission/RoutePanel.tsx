import { useState } from 'react'
import { useMission } from '../../state/missionStore'
import { useVehicle } from '../../state/vehicleStore'
import { bearing, haversine, destination, type LL } from '../../util/geo'
import { useEffectiveReturnPoint } from '../../util/effectiveHome'
import type { ReturnPointMode, TurnMode } from '@shared/mission'
import { TURN_OPTS } from '../../util/missionEnums'
import { LIMITS } from '../../util/limits'
import { Field, LatLonField, NumberInput, Select, ToggleRow, fieldStyles } from './fields'
import { Icon } from '../Icon'

/** 高度超过民航常规限高时给出提示，但不阻塞输入（反馈原文：考题常有 300/500m）。 */
function altHint(alt: number): string {
  return alt > LIMITS.altRegulatory
    ? `⚠ 已超过民航常规限高 ${LIMITS.altRegulatory}m，请确认空域/考试科目允许`
    : `安全限位 ${LIMITS.altMin}–${LIMITS.altMax}m`
}

export function RoutePanel(): JSX.Element {
  const selected = useMission((s) => s.selected)
  const name = useMission((s) => s.mission.name)
  const count = useMission((s) => s.mission.waypoints.length)
  const select = useMission((s) => s.select)

  const title = typeof selected === 'number' ? `航点 ${selected}` : selected === 'home' ? '起飞点' : selected === 'return' ? '返航点' : name
  const subtitle = typeof selected === 'number' ? '单航点参数' : selected === 'home' ? '起降参数' : selected === 'return' ? '返航参数' : `共 ${count} 个航点`

  return (
    <div
      className="panel"
      style={{
        position: 'absolute',
        left: 14,
        top: 14,
        bottom: 14,
        width: 296,
        zIndex: 5,
        display: 'flex',
        flexDirection: 'column',
        padding: 0
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 14px',
          borderBottom: '1px solid var(--stroke)'
        }}
      >
        {selected != null ? (
          <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => select(null)}>
            <Icon name="chevron-left" size={16} />
          </button>
        ) : (
          <Icon name="route" size={18} style={{ color: 'var(--primary)' }} />
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-lo)' }}>{subtitle}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {typeof selected === 'number' ? (
          <WaypointEditor seq={selected} />
        ) : selected === 'home' ? (
          <HomeEditor />
        ) : selected === 'return' ? (
          <ReturnEditor />
        ) : (
          <RouteSettings />
        )}
      </div>
      <style>{fieldStyles}</style>
    </div>
  )
}

function WaypointEditor({ seq }: { seq: number }): JSX.Element {
  const wp = useMission((s) => s.mission.waypoints.find((w) => w.seq === seq))
  const waypoints = useMission((s) => s.mission.waypoints)
  const update = useMission((s) => s.updateWaypoint)
  const home = useVehicle((s) => s.frame.home)

  if (!wp) return <div style={{ color: 'var(--text-lo)' }}>航点不存在</div>

  const idx = waypoints.findIndex((w) => w.seq === seq)
  const prev = idx > 0 ? waypoints[idx - 1] : home ? { lat: home.lat, lon: home.lon } : null
  const az = prev ? bearing(prev, wp) : 0
  const rel = prev ? haversine(prev, wp) : 0

  const setPolar = (azimuth: number, dist: number): void => {
    if (!prev) return
    const p = destination(prev, azimuth, dist)
    update(seq, { lat: p.lat, lon: p.lon, heading: azimuth })
  }

  return (
    <>
      <div className="label" style={{ color: 'var(--primary)', marginBottom: 8 }}>
        基础设置
      </div>
      <LatLonField label="经度" axis="lon" value={wp.lon} onChange={(v) => update(seq, { lon: v })} />
      <LatLonField label="纬度" axis="lat" value={wp.lat} onChange={(v) => update(seq, { lat: v })} />
      <Field label="高度" hint={altHint(wp.alt)}>
        <NumberInput value={wp.alt} step={1} min={LIMITS.altMin} max={LIMITS.altMax} unit="m" onChange={(v) => update(seq, { alt: v })} />
      </Field>
      <Field label="方位角（相对上一点）" hint={prev ? undefined : '无参考点（首点且未连接飞控）'}>
        <NumberInput value={+az.toFixed(1)} step={1} unit="°" onChange={(v) => setPolar(v, rel)} />
      </Field>
      <Field label="相对距离（相对上一点）">
        <NumberInput value={+rel.toFixed(1)} step={1} unit="m" onChange={(v) => setPolar(az, v)} />
      </Field>

      <div className="label" style={{ color: 'var(--primary)', margin: '14px 0 8px' }}>
        高级设置
      </div>
      <Field label="转弯方式">
        <Select value={wp.turnMode} onChange={(v) => update(seq, { turnMode: v })} options={TURN_OPTS} />
      </Field>
      <Field label="悬停时间">
        <NumberInput value={wp.hoverTime} step={1} min={LIMITS.hoverMin} max={LIMITS.hoverMax} unit="s" onChange={(v) => update(seq, { hoverTime: v })} />
      </Field>
      <Field label="水平速度（飞往该点）" hint="逐点设置：本机场景下无需单独设置起始速度">
        <NumberInput value={wp.speed} step={0.5} min={LIMITS.speedMin} max={LIMITS.speedMax} unit="m/s" onChange={(v) => update(seq, { speed: v })} />
      </Field>
    </>
  )
}

/** 起飞点编辑：直接编辑坐标，或相对某个已有航点用方位角+距离定位。 */
function HomeEditor(): JSX.Element {
  const homeOverride = useMission((s) => s.homeOverride)
  const setHomeOverride = useMission((s) => s.setHomeOverride)
  const waypoints = useMission((s) => s.mission.waypoints)
  const telHome = useVehicle((s) => s.frame.home)
  const [refSeq, setRefSeq] = useState<number | null>(null)

  const home: LL | null = homeOverride ?? (telHome ? { lat: telHome.lat, lon: telHome.lon } : null)
  const effectiveRefSeq = refSeq ?? waypoints[0]?.seq ?? null
  const refWp = waypoints.find((w) => w.seq === effectiveRefSeq) ?? null

  const az = refWp && home ? bearing(refWp, home) : 0
  const dist = refWp && home ? haversine(refWp, home) : 0

  const setPolar = (azimuth: number, distance: number): void => {
    if (!refWp) return
    setHomeOverride(destination(refWp, azimuth, distance))
  }

  return (
    <>
      {telHome && (
        <div
          style={{
            fontSize: 11.5,
            color: 'var(--accent)',
            background: 'rgba(242,161,0,0.1)',
            border: '1px solid rgba(242,161,0,0.35)',
            borderRadius: 8,
            padding: '8px 10px',
            marginBottom: 12,
            lineHeight: 1.6
          }}
        >
          已连接飞控：飞行时以飞控遥测的起飞点为准；这里编辑的是断开连接时用于预规划的起飞点。
        </div>
      )}
      <div className="label" style={{ color: 'var(--primary)', marginBottom: 8 }}>
        起飞点坐标
      </div>
      {home ? (
        <>
          <LatLonField label="经度" axis="lon" value={home.lon} onChange={(v) => setHomeOverride({ lat: home.lat, lon: v })} />
          <LatLonField label="纬度" axis="lat" value={home.lat} onChange={(v) => setHomeOverride({ lat: v, lon: home.lon })} />
        </>
      ) : (
        <div style={{ fontSize: 12.5, color: 'var(--text-mid)', lineHeight: 1.7 }}>
          尚未设置起飞点。用右侧工具栏"设置起飞点"在地图上点选，或
          <button
            className="btn ghost"
            style={{ padding: '1px 6px', fontSize: 12, color: 'var(--primary)' }}
            onClick={() => setHomeOverride({ lat: 22.889482, lon: 113.400647 })}
          >
            使用默认坐标
          </button>
          后在此编辑。
        </div>
      )}

      {home && waypoints.length > 0 && (
        <>
          <div className="label" style={{ color: 'var(--primary)', margin: '14px 0 8px' }}>
            相对航点定位
          </div>
          <Field label="参考航点">
            <Select
              value={String(effectiveRefSeq)}
              onChange={(v) => setRefSeq(Number(v))}
              options={waypoints.map((w) => ({ value: String(w.seq), label: `航点 ${w.seq}` }))}
            />
          </Field>
          <Field label="方位角（参考航点 → 起飞点）">
            <NumberInput value={+az.toFixed(1)} step={1} unit="°" onChange={(v) => setPolar(v, dist)} />
          </Field>
          <Field label="相对距离">
            <NumberInput value={+dist.toFixed(1)} step={1} unit="m" onChange={(v) => setPolar(az, v)} />
          </Field>
        </>
      )}
    </>
  )
}

/** 返航点编辑：与起飞点相同 / 自定义坐标 / 与某航点重合。 */
function ReturnEditor(): JSX.Element {
  const mission = useMission((s) => s.mission)
  const setReturnPointMode = useMission((s) => s.setReturnPointMode)
  const setReturnCustom = useMission((s) => s.setReturnCustom)
  const setReturnWaypoint = useMission((s) => s.setReturnWaypoint)
  const setMission = useMission((s) => s.setMission)
  const waypoints = mission.waypoints
  const returnPt = useEffectiveReturnPoint()

  const onModeChange = (mode: ReturnPointMode): void => {
    if (mode === 'home') setReturnPointMode('home')
    else if (mode === 'waypoint') setReturnWaypoint(waypoints[0]?.seq ?? null)
    else setReturnCustom(returnPt ?? { lat: 22.889482, lon: 113.400647 })
  }

  return (
    <>
      <Field label="返航点来源">
        <Select
          value={mission.returnPointMode}
          onChange={onModeChange}
          options={[
            { value: 'home', label: '与起飞点相同' },
            { value: 'custom', label: '自定义坐标' },
            { value: 'waypoint', label: '与某航点重合', ...(waypoints.length === 0 ? { disabled: true } : {}) }
          ]}
        />
      </Field>

      {mission.returnPointMode === 'waypoint' && (
        <Field label="重合航点">
          <Select
            value={String(mission.returnWaypointSeq ?? waypoints[0]?.seq ?? '')}
            onChange={(v) => setReturnWaypoint(Number(v))}
            options={waypoints.map((w) => ({ value: String(w.seq), label: `航点 ${w.seq}` }))}
          />
        </Field>
      )}

      {mission.returnPointMode === 'custom' && returnPt && (
        <>
          <LatLonField label="经度" axis="lon" value={returnPt.lon} onChange={(v) => setReturnCustom({ lat: returnPt.lat, lon: v })} />
          <LatLonField label="纬度" axis="lat" value={returnPt.lat} onChange={(v) => setReturnCustom({ lat: v, lon: returnPt.lon })} />
        </>
      )}

      {mission.returnPointMode === 'home' && (
        <div style={{ fontSize: 12, color: 'var(--text-lo)', marginBottom: 10 }}>
          返航点坐标与起飞点一致，可在左上角"起飞点"面板编辑。
        </div>
      )}

      <div className="label" style={{ color: 'var(--primary)', margin: '14px 0 8px' }}>
        返航参数
      </div>
      <Field label="返航高度" hint={altHint(mission.returnAlt)}>
        <NumberInput value={mission.returnAlt} step={1} min={LIMITS.altMin} max={LIMITS.altMax} unit="m" onChange={(v) => setMission({ returnAlt: v })} />
      </Field>
      <Field label="返航速度">
        <NumberInput value={mission.returnSpeed} step={0.5} min={LIMITS.speedMin} max={LIMITS.speedMax} unit="m/s" onChange={(v) => setMission({ returnSpeed: v })} />
      </Field>
    </>
  )
}

function ApplyRow({
  label,
  children,
  onApply
}: {
  label: string
  children: React.ReactNode
  onApply: () => void
}) {
  return (
    <div
      style={{ marginBottom: 10 }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onApply()
      }}
    >
      <div className="label" style={{ marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>{children}</div>
        <button className="btn" style={{ padding: '0 12px' }} onClick={onApply} title="也可在输入框内按 Enter 确认">
          修改
        </button>
      </div>
    </div>
  )
}

function RouteSettings(): JSX.Element {
  const mission = useMission((s) => s.mission)
  const applyToAll = useMission((s) => s.applyToAll)
  const setMission = useMission((s) => s.setMission)
  const select = useMission((s) => s.select)

  const [allAlt, setAllAlt] = useState(50)
  const [allSpeed, setAllSpeed] = useState(8)
  const [allTurn, setAllTurn] = useState<TurnMode>('stop')
  const [allHover, setAllHover] = useState(1)

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button className="btn" style={{ flex: 1, fontSize: 12.5 }} onClick={() => select('home')}>
          <Icon name="home" size={14} /> 起飞点
        </button>
        <button className="btn" style={{ flex: 1, fontSize: 12.5 }} onClick={() => select('return')}>
          <Icon name="rtl" size={14} /> 返航点
        </button>
      </div>

      <div className="label" style={{ color: 'var(--primary)', marginBottom: 8 }}>
        批量修改所有航点
      </div>
      <ApplyRow label="修改所有航点高度" onApply={() => applyToAll({ alt: allAlt })}>
        <NumberInput value={allAlt} step={1} min={LIMITS.altMin} max={LIMITS.altMax} unit="m" onChange={setAllAlt} />
      </ApplyRow>
      <ApplyRow label="修改所有航点速度" onApply={() => applyToAll({ speed: allSpeed })}>
        <NumberInput value={allSpeed} step={0.5} min={LIMITS.speedMin} max={LIMITS.speedMax} unit="m/s" onChange={setAllSpeed} />
      </ApplyRow>
      <ApplyRow label="修改所有航点转弯模式" onApply={() => applyToAll({ turnMode: allTurn })}>
        <Select value={allTurn} onChange={setAllTurn} options={TURN_OPTS} />
      </ApplyRow>
      <ApplyRow label="修改所有航点悬停时间" onApply={() => applyToAll({ hoverTime: allHover })}>
        <NumberInput value={allHover} step={1} min={LIMITS.hoverMin} max={LIMITS.hoverMax} unit="s" onChange={setAllHover} />
      </ApplyRow>

      <div className="label" style={{ color: 'var(--primary)', margin: '14px 0 8px' }}>
        航线参数
      </div>
      <Field label="起始速度（起飞点→第一个航点）">
        <NumberInput value={mission.startSpeed} step={0.5} min={LIMITS.speedMin} max={LIMITS.speedMax} unit="m/s" onChange={(v) => setMission({ startSpeed: v })} />
      </Field>
      <Field label="完成动作">
        <Select
          value={mission.finishAction}
          onChange={(v) => setMission({ finishAction: v })}
          options={[
            { value: 'hover', label: '原地悬停' },
            { value: 'hoverHome', label: '返回起飞点悬停' },
            { value: 'rtl', label: '返航' },
            { value: 'land', label: '降落' }
          ]}
        />
      </Field>
      <ToggleRow label="无限循环" value={mission.infiniteLoop} onChange={(v) => setMission({ infiniteLoop: v })} />
      <Field label="循环次数" hint={mission.infiniteLoop ? '已开启无限循环，次数不生效' : undefined}>
        <NumberInput
          value={mission.loopCount}
          step={1}
          min={1}
          max={LIMITS.loopMax}
          unit="次"
          disabled={mission.infiniteLoop}
          onChange={(v) => setMission({ loopCount: v })}
        />
      </Field>
      <ToggleRow label="航线闭合" value={mission.closed} onChange={(v) => setMission({ closed: v })} />
      <Field label="航线起始点">
        <NumberInput
          value={mission.startIndex}
          step={1}
          min={1}
          max={Math.max(1, mission.waypoints.length)}
          onChange={(v) => setMission({ startIndex: v })}
        />
      </Field>
      <Field label="爬升类型">
        <Select
          value={mission.climbType}
          onChange={(v) => setMission({ climbType: v })}
          options={[
            { value: 'vertical', label: '垂直爬升' },
            { value: 'inclined', label: '斜线爬升' }
          ]}
        />
      </Field>
    </>
  )
}
