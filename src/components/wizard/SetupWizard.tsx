import { useEffect, useState } from 'react'
import { useParams } from '../../state/paramStore'
import { useLink } from '../../state/linkStore'
import { useUi } from '../../state/uiStore'
import { useVehicleField } from '../../state/useVehicleField'
import {
  AHRS_ORIENTATION,
  FENCE_ACTION,
  FRAME_CLASS,
  FRAME_MOTORS,
  FRAME_TYPE,
  FS_ACTION,
  FS_THR,
  FLIGHT_MODES
} from '../../mavlink/params'
import { ParamEnum, ParamNumber, ParamToggle } from './paramFields'
import { MotorDiagram } from './MotorDiagram'
import { fieldStyles } from '../mission/fields'
import { Icon } from '../Icon'

const STEPS = ['机架类型', '电机测试', '飞控安装', 'GPS安装', '安全项', '遥控器']

export function SetupWizard(): JSX.Element {
  const [step, setStep] = useState(0)
  const connected = useLink((s) => s.status.state === 'connected')
  const loaded = useParams((s) => s.loaded)
  const loading = useParams((s) => s.loading)
  const load = useParams((s) => s.load)
  const go = useUi((s) => s.go)

  useEffect(() => {
    if (connected && !loaded && !loading) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected])

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      {/* 步骤条 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '16px 26px',
          borderBottom: '1px solid var(--stroke)',
          background: 'rgba(11,17,30,0.6)'
        }}
      >
        {STEPS.map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => setStep(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderRadius: 999,
                background: i === step ? 'var(--primary-dim)' : 'transparent',
                border: `1px solid ${i === step ? 'var(--primary)' : 'transparent'}`
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  background: i < step ? 'var(--success)' : i === step ? 'var(--primary)' : 'var(--bg-3)',
                  color: i <= step ? '#04121a' : 'var(--text-lo)'
                }}
              >
                {i < step ? '✓' : i + 1}
              </span>
              <span style={{ fontSize: 13, color: i === step ? 'var(--primary)' : 'var(--text-mid)' }}>{s}</span>
            </button>
            {i < STEPS.length - 1 && <div style={{ width: 18, height: 1, background: 'var(--stroke)' }} />}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        {!connected && (
          <span style={{ fontSize: 12, color: 'var(--accent)' }}>未连接 · 显示默认演示参数</span>
        )}
        {loading && <span style={{ fontSize: 12, color: 'var(--text-mid)' }}>读取参数中…</span>}
      </div>

      {/* 内容 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 26px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {step === 0 && <FrameStep />}
          {step === 1 && <MotorTestStep />}
          {step === 2 && <FcMountStep />}
          {step === 3 && <GpsMountStep />}
          {step === 4 && <SafetyStep />}
          {step === 5 && <RcStep />}
        </div>
      </div>

      {/* 底部导航 */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          padding: '14px 26px',
          borderTop: '1px solid var(--stroke)',
          background: 'rgba(11,17,30,0.6)'
        }}
      >
        <button className="btn" onClick={() => go('home')}>
          <Icon name="home" size={16} /> 退出向导
        </button>
        <div style={{ flex: 1 }} />
        <button className="btn" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          上一步
        </button>
        {step < STEPS.length - 1 ? (
          <button className="btn primary" onClick={() => setStep((s) => s + 1)}>
            下一步 <Icon name="chevron-left" size={15} style={{ transform: 'rotate(180deg)' }} />
          </button>
        ) : (
          <button className="btn primary" onClick={() => go('home')}>
            <Icon name="save" size={15} /> 完成
          </button>
        )}
      </div>
      <style>{fieldStyles}</style>
    </div>
  )
}

function StepTitle({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h2 style={{ margin: 0, fontSize: 20 }}>{title}</h2>
      <div style={{ color: 'var(--text-mid)', fontSize: 13, marginTop: 4 }}>{desc}</div>
    </div>
  )
}

function Two({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 18px' }}>{children}</div>
}

// ---------------- 步骤1 机架 ----------------
function FrameStep(): JSX.Element {
  const frameClass = useParams((s) => s.params['FRAME_CLASS'] ?? 2)
  const setParam = useParams((s) => s.setParam)
  return (
    <>
      <StepTitle title="设置机架类型" desc="根据实际机型选择对应的机架类型与布局。" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }}>
        {FRAME_CLASS.map((f) => (
          <button
            key={f.value}
            className="panel"
            onClick={() => setParam('FRAME_CLASS', f.value)}
            style={{
              padding: 14,
              cursor: 'pointer',
              borderColor: frameClass === f.value ? 'var(--primary)' : 'var(--stroke)',
              boxShadow: frameClass === f.value ? '0 0 0 1px var(--primary), inset 0 1px 0 var(--stroke-hi)' : undefined
            }}
          >
            <MotorDiagram count={FRAME_MOTORS[f.value] ?? 4} size={120} />
            <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: frameClass === f.value ? 'var(--primary)' : 'var(--text-hi)' }}>
              {f.label}
            </div>
          </button>
        ))}
      </div>
      <div style={{ maxWidth: 320 }}>
        <ParamEnum id="FRAME_TYPE" label="机架布局" options={FRAME_TYPE} fallback={1} />
      </div>
    </>
  )
}

// ---------------- 步骤2 电机测试 ----------------
function MotorTestStep(): JSX.Element {
  const frameClass = useParams((s) => s.params['FRAME_CLASS'] ?? 2)
  const count = FRAME_MOTORS[frameClass] ?? 6
  const [safe, setSafe] = useState(false)
  const [active, setActive] = useState<number | null>(null)
  const [pct, setPct] = useState(8)

  const test = (motor: number): void => {
    if (!safe) return
    setActive(motor)
    window.gcs.command({ type: 'motorTest', motor, percent: pct })
    setTimeout(() => setActive((a) => (a === motor ? null : a)), 1600)
  }

  return (
    <>
      <StepTitle title="电机测试" desc="拖动/点击测试各电机，确认转向与编号一致（M1/M3/M5 顺时针，M2/M4/M6 逆时针）。" />
      <div
        className="panel"
        style={{ padding: 12, marginBottom: 16, borderColor: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 12 }}
      >
        <Icon name="propeller" size={22} style={{ color: 'var(--danger)' }} />
        <div style={{ flex: 1, fontSize: 13, color: '#ffd9d6' }}>
          危险：测试电机前<strong>务必卸下所有螺旋桨</strong>。
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={safe} onChange={(e) => setSafe(e.target.checked)} />
          已卸桨，确认安全
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'center' }}>
        <MotorDiagram count={count} active={active} />
        <div>
          <div className="label" style={{ marginBottom: 6 }}>测试油门：{pct}%</div>
          <input
            type="range"
            min={4}
            max={30}
            value={pct}
            onChange={(e) => setPct(+e.target.value)}
            style={{ width: '100%', marginBottom: 16, accentColor: 'var(--primary)' }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {Array.from({ length: count }, (_, i) => i + 1).map((m) => (
              <button
                key={m}
                className="btn"
                disabled={!safe}
                onClick={() => test(m)}
                style={{
                  padding: '10px 0',
                  borderColor: active === m ? 'var(--primary)' : 'var(--stroke)',
                  color: active === m ? 'var(--primary)' : 'var(--text-hi)'
                }}
              >
                M{m}
              </button>
            ))}
          </div>
          <button
            className="btn primary"
            disabled={!safe}
            style={{ marginTop: 12, width: '100%' }}
            onClick={() => {
              let i = 1
              const seq = setInterval(() => {
                if (i > count) return clearInterval(seq)
                test(i)
                i++
              }, 1200)
            }}
          >
            <Icon name="play" size={15} /> 依次测试全部电机
          </button>
        </div>
      </div>
    </>
  )
}

// ---------------- 步骤3 飞控安装 ----------------
function FcMountStep(): JSX.Element {
  return (
    <>
      <StepTitle title="飞控安装偏移" desc="若飞控未安装在机架正中心，按实际位置设置偏移；并选择飞控安装方向。" />
      <div style={{ maxWidth: 320, marginBottom: 8 }}>
        <ParamEnum id="AHRS_ORIENTATION" label="飞控安装方向" options={AHRS_ORIENTATION} />
      </div>
      <Two>
        <ParamNumber id="INS_POS1_X" label="X 偏移（前+）" unit="m" step={0.01} />
        <ParamNumber id="INS_POS1_Y" label="Y 偏移（右+）" unit="m" step={0.01} />
        <ParamNumber id="INS_POS1_Z" label="Z 偏移（下+）" unit="m" step={0.01} />
      </Two>
    </>
  )
}

// ---------------- 步骤4 GPS安装 ----------------
function GpsMountStep(): JSX.Element {
  return (
    <>
      <StepTitle title="GPS 安装偏移" desc="按实际安装位置设置 GPS 偏移；GPS1 与 GPS2 应一一对应。" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <div className="label" style={{ color: 'var(--primary)', marginBottom: 8 }}>GPS 1</div>
          <ParamNumber id="GPS_POS1_X" label="X 偏移（前+）" unit="m" step={0.01} />
          <ParamNumber id="GPS_POS1_Y" label="Y 偏移（右+）" unit="m" step={0.01} />
          <ParamNumber id="GPS_POS1_Z" label="Z 偏移（下+）" unit="m" step={0.01} />
        </div>
        <div>
          <div className="label" style={{ color: 'var(--primary)', marginBottom: 8 }}>GPS 2</div>
          <ParamNumber id="GPS_POS2_X" label="X 偏移（前+）" unit="m" step={0.01} />
          <ParamNumber id="GPS_POS2_Y" label="Y 偏移（右+）" unit="m" step={0.01} />
          <ParamNumber id="GPS_POS2_Z" label="Z 偏移（下+）" unit="m" step={0.01} />
        </div>
      </div>
    </>
  )
}

// ---------------- 步骤5 安全项 ----------------
function SafetyStep(): JSX.Element {
  return (
    <>
      <StepTitle title="安全选项设置" desc="返航高度、低电压保护、电子围栏、失控保护与指南针校准。" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
        <div>
          <div className="label" style={{ color: 'var(--primary)', marginBottom: 8 }}>返航</div>
          <ParamNumber id="RTL_ALT" label="返航高度" unit="m" scale={100} step={1} fallback={6000} />
          <ParamNumber id="RTL_SPEED" label="返航速度" unit="m/s" scale={100} step={0.5} fallback={1000} />

          <div className="label" style={{ color: 'var(--primary)', margin: '14px 0 8px' }}>电压保护</div>
          <ParamNumber id="BATT_LOW_VOLT" label="一级保护电压" unit="V" step={0.1} fallback={21.6} />
          <ParamEnum id="BATT_FS_LOW_ACT" label="一级保护动作" options={FS_ACTION} fallback={2} />
          <ParamNumber id="BATT_CRT_VOLT" label="二级保护电压" unit="V" step={0.1} fallback={20.4} />
          <ParamEnum id="BATT_FS_CRT_ACT" label="二级保护动作" options={FS_ACTION} fallback={1} />
        </div>
        <div>
          <div className="label" style={{ color: 'var(--primary)', marginBottom: 8 }}>电子围栏</div>
          <ParamToggle id="FENCE_ENABLE" label="启用电子围栏" />
          <ParamNumber id="FENCE_RADIUS" label="最大半径" unit="m" step={5} fallback={300} />
          <ParamNumber id="FENCE_ALT_MAX" label="最大高度" unit="m" step={5} fallback={120} />
          <ParamEnum id="FENCE_ACTION" label="触发动作" options={FENCE_ACTION} fallback={1} />

          <div className="label" style={{ color: 'var(--primary)', margin: '14px 0 8px' }}>失控保护</div>
          <ParamEnum id="FS_THR_ENABLE" label="遥控失联动作" options={FS_THR} fallback={1} />
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <CompassCal />
      </div>
    </>
  )
}

function CompassCal(): JSX.Element {
  const [pct, setPct] = useState<number | null>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const off = window.gcs.onCalProgress((p) => {
      setPct(p.percent)
      if (p.done) {
        setMsg(p.message ?? (p.success ? '校准成功' : '校准结束'))
        setTimeout(() => setPct(null), 1500)
      }
    })
    return off
  }, [])

  const running = pct !== null && pct < 100
  return (
    <div className="panel" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Icon name="compass" size={22} style={{ color: 'var(--primary)' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>指南针（磁罗盘）校准</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-lo)' }}>
            远离强磁与金属，按提示水平/垂直各方向旋转飞行器。校准后需重启飞控生效。
          </div>
        </div>
        {pct === null ? (
          <button className="btn primary" onClick={() => { setMsg(''); window.gcs.command({ type: 'compassCal', start: true }) }}>
            开始校准
          </button>
        ) : (
          <button className="btn danger" onClick={() => window.gcs.command({ type: 'compassCal', start: false })}>
            取消
          </button>
        )}
      </div>
      {pct !== null && (
        <div style={{ marginTop: 12 }}>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: running ? 'var(--primary)' : 'var(--success)', transition: 'width .2s' }} />
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-mid)', marginTop: 5 }}>{running ? `校准中… ${pct}%` : msg}</div>
        </div>
      )}
    </div>
  )
}

// ---------------- 步骤6 遥控器 ----------------
function RcStep(): JSX.Element {
  const rc = useVehicleField((f) => f.rc)
  const names = ['横滚 CH1', '俯仰 CH2', '油门 CH3', '偏航 CH4', '模式 CH5', '辅助 CH6']
  return (
    <>
      <StepTitle title="遥控器设置" desc="设置飞行模式通道与各段模式；核对通道方向与行程。" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <div className="label" style={{ color: 'var(--primary)', marginBottom: 8 }}>飞行模式（通道 5 六段）</div>
          <ParamNumber id="FLTMODE_CH" label="模式通道" step={1} min={5} max={8} fallback={5} />
          <ParamEnum id="FLTMODE1" label="档位 1" options={FLIGHT_MODES} fallback={0} />
          <ParamEnum id="FLTMODE2" label="档位 2" options={FLIGHT_MODES} fallback={2} />
          <ParamEnum id="FLTMODE3" label="档位 3" options={FLIGHT_MODES} fallback={5} />
          <ParamEnum id="FLTMODE4" label="档位 4" options={FLIGHT_MODES} fallback={16} />
          <ParamEnum id="FLTMODE5" label="档位 5" options={FLIGHT_MODES} fallback={6} />
          <ParamEnum id="FLTMODE6" label="档位 6" options={FLIGHT_MODES} fallback={3} />
        </div>
        <div>
          <div className="label" style={{ color: 'var(--primary)', marginBottom: 8 }}>通道监视（实时）</div>
          {names.map((nm, i) => {
            const v = rc[i] ?? 1500
            const pct = Math.max(0, Math.min(100, ((v - 1000) / 1000) * 100))
            return (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-mid)' }}>{nm}</span>
                  <span className="readout" style={{ color: 'var(--primary)' }}>{v}</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,.06)', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--stroke)' }} />
                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: 'var(--primary)' }} />
                </div>
              </div>
            )
          })}
          <div className="label" style={{ color: 'var(--primary)', margin: '14px 0 8px' }}>行程校准（前 4 通道）</div>
          <div style={{ fontSize: 12, color: 'var(--text-lo)', marginBottom: 8 }}>
            拨动摇杆至最大/最小，校准将写入各通道 MIN/MAX/TRIM。以下为当前值：
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0 10px' }}>
            <ParamNumber id="RC3_MIN" label="油门 MIN" step={1} fallback={1000} />
            <ParamNumber id="RC3_TRIM" label="油门 TRIM" step={1} fallback={1500} />
            <ParamNumber id="RC3_MAX" label="油门 MAX" step={1} fallback={2000} />
          </div>
        </div>
      </div>
    </>
  )
}
