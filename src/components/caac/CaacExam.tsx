import { useEffect } from 'react'
import { FlightMap } from '../map/FlightMap'
import { CaacOverlay } from './CaacOverlay'
import { TopStatusBar } from '../layout/TopStatusBar'
import { MapToolbar } from '../layout/MapToolbar'
import { useCaac } from '../../state/caacStore'
import { useVehicle } from '../../state/vehicleStore'
import { useLink } from '../../state/linkStore'
import { autoPylons } from '../../util/figure8'
import { NumberInput, Field, fieldStyles } from '../mission/fields'
import { Icon } from '../Icon'
import { n } from '../../util/format'

export function CaacExam(): JSX.Element {
  const caac = useCaac()
  const connected = useLink((s) => s.status.state === 'connected')
  const connect = useLink((s) => s.connect)

  // 实时评分采样
  useEffect(() => {
    const unsub = useVehicle.subscribe((s) => useCaac.getState().sample(s.frame))
    return unsub
  }, [])

  const autoPlace = (): void => {
    const home = useVehicle.getState().frame.home ?? { lat: 22.889482, lon: 113.400647 }
    const { a, b } = autoPylons(home, caac.radius, 90)
    caac.setPylons(a, b)
  }

  const startExam = (): void => {
    caac.start(useVehicle.getState().frame)
  }

  const runDemo = async (): Promise<void> => {
    if (!connected) await connect({ kind: 'sim' })
    if (!caac.pylonA || !caac.pylonB) autoPlace()
    const st = useCaac.getState()
    if (st.pylonA && st.pylonB) {
      window.gcs.command({ type: 'simFigure8', enable: true, a: st.pylonA, b: st.pylonB, alt: 30 })
      setTimeout(() => useCaac.getState().start(useVehicle.getState().frame), 300)
    }
  }

  const m = caac.metrics
  const hasPylons = !!(caac.pylonA && caac.pylonB)

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <TopStatusBar />
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <FlightMap />
        <CaacOverlay />
        <MapToolbar corner="br" />

        {/* 左侧考试面板 */}
        <div
          className="panel"
          style={{
            position: 'absolute',
            left: 14,
            top: 14,
            bottom: 14,
            width: 300,
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            zIndex: 5
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 16px', borderBottom: '1px solid var(--stroke)' }}>
            <Icon name="caac" size={19} style={{ color: 'var(--accent)' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>绕八字飞行考试</div>
              <div style={{ fontSize: 11, color: 'var(--text-lo)' }}>CAAC 机长 / 教员科目</div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {/* 布桩 */}
            <div className="label" style={{ color: 'var(--primary)', marginBottom: 8 }}>电子桩设置</div>
            <div
              style={{
                fontSize: 11.5,
                color: 'var(--accent)',
                background: 'rgba(242,161,0,.1)',
                border: '1px solid rgba(242,161,0,.3)',
                borderRadius: 6,
                padding: '7px 10px',
                marginBottom: 12
              }}
            >
              内置电子桩需配合 RTK 使用以保证精度；仿真下可直接演示。
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button
                className="btn"
                style={{ flex: 1, borderColor: caac.placeMode === 'a' ? 'var(--primary)' : 'var(--stroke)', color: caac.placeMode === 'a' ? 'var(--primary)' : undefined }}
                onClick={() => caac.setPlaceMode(caac.placeMode === 'a' ? 'none' : 'a')}
              >
                {caac.pylonA ? '桩A ✓' : '设置桩A'}
              </button>
              <button
                className="btn"
                style={{ flex: 1, borderColor: caac.placeMode === 'b' ? 'var(--primary)' : 'var(--stroke)', color: caac.placeMode === 'b' ? 'var(--primary)' : undefined }}
                onClick={() => caac.setPlaceMode(caac.placeMode === 'b' ? 'none' : 'b')}
              >
                {caac.pylonB ? '桩B ✓' : '设置桩B'}
              </button>
            </div>
            {caac.placeMode !== 'none' && (
              <div style={{ fontSize: 11.5, color: 'var(--primary)', marginBottom: 10 }}>
                点击地图设置桩{caac.placeMode.toUpperCase()}位置
              </div>
            )}
            <Field label="圆半径">
              <NumberInput value={caac.radius} step={5} min={10} unit="m" onChange={caac.setRadius} />
            </Field>
            <button className="btn" style={{ width: '100%', marginBottom: 16 }} onClick={autoPlace}>
              <Icon name="target" size={15} /> 以起飞点自动布桩
            </button>

            {/* 评分 */}
            <div className="label" style={{ color: 'var(--primary)', marginBottom: 8 }}>实时评分</div>
            <Score label="完成圈数" value={`${m.laps} / ${caac.reqLaps}`} ok={m.laps >= caac.reqLaps} />
            <Score label="最大横向偏差" value={`${n(m.maxDeviation, 2)} m`} ok={m.maxDeviation <= caac.devTol} tol={`≤${caac.devTol}m`} />
            <Score label="平均偏差" value={`${n(m.avgDeviation, 2)} m`} />
            <Score label="高度保持" value={`${n(m.altHoldMax, 2)} m`} ok={m.altHoldMax <= caac.altTol} tol={`≤${caac.altTol}m`} />
            <Score label="用时" value={`${n(m.time, 0)} s`} />

            {caac.result !== 'none' && (
              <div
                style={{
                  marginTop: 12,
                  padding: '12px',
                  borderRadius: 8,
                  textAlign: 'center',
                  fontWeight: 700,
                  fontSize: 16,
                  color: caac.result === 'pass' ? 'var(--success)' : 'var(--danger)',
                  border: `1px solid ${caac.result === 'pass' ? 'var(--success)' : 'var(--danger)'}`,
                  background: caac.result === 'pass' ? 'rgba(34,224,138,.1)' : 'rgba(230,51,40,.1)'
                }}
              >
                {caac.result === 'pass' ? '✓ 考试通过' : '✗ 考试不合格'}
              </div>
            )}
          </div>

          {/* 底部操作 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14, borderTop: '1px solid var(--stroke)' }}>
            {!caac.running ? (
              <button className="btn primary" disabled={!hasPylons} onClick={startExam}>
                <Icon name="play" size={16} /> 开始考试
              </button>
            ) : (
              <button className="btn danger" onClick={() => caac.stop()}>
                <Icon name="stop" size={16} /> 结束并评分
              </button>
            )}
            <button className="btn" onClick={runDemo}>
              <Icon name="caac" size={15} /> 仿真演示：自动绕八字
            </button>
          </div>
        </div>
      </div>
      <style>{fieldStyles}</style>
    </div>
  )
}

function Score({ label, value, ok, tol }: { label: string; value: string; ok?: boolean; tol?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0', borderBottom: '1px solid var(--stroke-soft)' }}>
      <span style={{ fontSize: 12.5, color: 'var(--text-mid)' }}>
        {label}
        {tol && <span style={{ fontSize: 10, color: 'var(--text-lo)', marginLeft: 4 }}>{tol}</span>}
      </span>
      <span className="readout" style={{ fontSize: 14, color: ok === undefined ? 'var(--text-hi)' : ok ? 'var(--success)' : 'var(--danger)' }}>
        {value}
      </span>
    </div>
  )
}
