import { useEffect, useRef, useState } from 'react'
import { FlightMap } from '../map/FlightMap'
import { TopStatusBar } from '../layout/TopStatusBar'
import { BottomInstrumentBar } from '../layout/BottomInstrumentBar'
import { MapToolbar } from '../layout/MapToolbar'
import { useLog } from '../../state/logStore'
import { useVehicle } from '../../state/vehicleStore'
import { emptyFrame } from '@shared/telemetry'
import type { LogSession } from '../../state/logStore'
import { Icon } from '../Icon'
import { clock } from '../../util/format'

const SPEEDS = [0.5, 1, 2, 4, 8]

export function LogReplay(): JSX.Element {
  const source = useLog((s) => s.source)
  const loadCurrent = useLog((s) => s.loadCurrent)
  const loadSession = useLog((s) => s.loadSession)
  const bufferLen = useLog((s) => s.buffer.length)

  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0) // 当前索引
  const [speed, setSpeed] = useState(1)
  const rafRef = useRef<number>(0)
  const posMsRef = useRef(0)

  const frames = source?.frames ?? []
  const t0 = frames[0]?.t ?? 0
  const tEnd = frames[frames.length - 1]?.t ?? 0
  const duration = Math.max(0, tEnd - t0)

  // 进入回放模式
  useEffect(() => {
    useVehicle.getState().setReplayMode(true)
    return () => {
      useVehicle.getState().setReplayMode(false)
      useVehicle.getState().reset()
    }
  }, [])

  // 应用某一索引到 vehicleStore
  const apply = (idx: number): void => {
    if (frames.length === 0) return
    const i = Math.max(0, Math.min(frames.length - 1, idx))
    const f = frames[i]
    const track: [number, number][] = []
    for (let k = 0; k <= i; k++) {
      const fr = frames[k]
      if (fr.gpsFix !== 'none' && fr.gpsFix !== 'no-fix' && fr.lat !== 0) track.push([fr.lon, fr.lat])
    }
    useVehicle.getState().setReplay(f, track)
  }

  // 播放循环
  useEffect(() => {
    if (!playing || frames.length === 0) return
    let prev = performance.now()
    const loop = (now: number): void => {
      const dt = now - prev
      prev = now
      posMsRef.current += dt * speed
      if (posMsRef.current >= duration) {
        posMsRef.current = duration
        setPlaying(false)
      }
      // 找到 t <= t0+posMs 的最大索引
      const target = t0 + posMsRef.current
      let i = pos
      while (i < frames.length - 1 && frames[i + 1].t <= target) i++
      while (i > 0 && frames[i].t > target) i--
      setPos(i)
      apply(i)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, source])

  const seek = (idx: number): void => {
    setPlaying(false)
    setPos(idx)
    posMsRef.current = (frames[idx]?.t ?? t0) - t0
    apply(idx)
  }

  const onImport = (file: File): void => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as LogSession
        if (Array.isArray(data.frames)) {
          loadSession({ name: file.name, frames: data.frames })
          setPlaying(false)
          setPos(0)
          posMsRef.current = 0
        }
      } catch {
        /* ignore */
      }
    }
    reader.readAsText(file)
  }

  if (frames.length === 0) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <div className="panel" style={{ padding: 30, textAlign: 'center', width: 460 }}>
          <Icon name="list" size={34} style={{ color: 'var(--primary)' }} />
          <h2 style={{ margin: '12px 0 6px', fontSize: 20 }}>飞行日志回放</h2>
          <div style={{ color: 'var(--text-mid)', fontSize: 13, marginBottom: 20, lineHeight: 1.7 }}>
            回放本次会话记录的飞行，或导入已保存的 <code>.json</code> 日志。
            <br />
            飞行日志也存于飞控 TF 卡的 <code>APM/logs</code> 目录（<code>.lklog</code>）。
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn primary" disabled={bufferLen === 0} onClick={loadCurrent}>
              <Icon name="play" size={16} /> 回放当前会话（{bufferLen} 帧）
            </button>
            <label className="btn" style={{ cursor: 'pointer' }}>
              <Icon name="download" size={16} /> 导入日志文件
              <input
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
              />
            </label>
          </div>
        </div>
      </div>
    )
  }

  const cur = frames[pos] ?? emptyFrame()
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <TopStatusBar />
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <FlightMap />
        <MapToolbar corner="br" />
        <div
          className="panel"
          style={{ position: 'absolute', left: 14, top: 14, padding: '8px 14px', zIndex: 5, fontSize: 12.5, color: 'var(--text-mid)' }}
        >
          <Icon name="list" size={14} style={{ color: 'var(--primary)', verticalAlign: -2, marginRight: 6 }} />
          回放：{source?.name} · 回放模式（实时遥测已暂停）
        </div>
        <BottomInstrumentBar />
      </div>

      {/* 时间轴 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 22px', borderTop: '1px solid var(--stroke)', background: 'rgba(11,17,30,0.7)' }}>
        <button className="icon-btn active" onClick={() => setPlaying((p) => !p)} style={{ width: 44, height: 44, borderRadius: '50%' }}>
          <Icon name={playing ? 'stop' : 'play'} size={20} />
        </button>
        <span className="readout" style={{ fontSize: 13, color: 'var(--primary)', width: 54 }}>
          {clock((cur.t - t0) / 1000)}
        </span>
        <input
          type="range"
          min={0}
          max={frames.length - 1}
          value={pos}
          onChange={(e) => seek(+e.target.value)}
          style={{ flex: 1, accentColor: 'var(--primary)' }}
        />
        <span className="readout" style={{ fontSize: 13, color: 'var(--text-lo)', width: 54 }}>{clock(duration / 1000)}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {SPEEDS.map((s) => (
            <button
              key={s}
              className="btn"
              onClick={() => setSpeed(s)}
              style={{
                padding: '5px 9px',
                fontSize: 12,
                borderColor: speed === s ? 'var(--primary)' : 'var(--stroke)',
                color: speed === s ? 'var(--primary)' : 'var(--text-mid)'
              }}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
