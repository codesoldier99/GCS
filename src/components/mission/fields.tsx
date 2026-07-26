import { useEffect, useState, type ReactNode } from 'react'
import { Icon } from '../Icon'
import { clamp, LIMITS } from '../../util/limits'
import { toDMS, fromDMS, type Dms } from '../../util/dms'

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <div className="label" style={{ marginBottom: 5 }}>
        {label}
      </div>
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--text-lo)', marginTop: 4 }}>{hint}</div>}
    </label>
  )
}

/** 清理浮点误差/超长小数（如 bearing/destination 计算产生的 113.40023570403581999…）后转字符串。 */
function formatNum(v: number, decimals?: number): string {
  if (!Number.isFinite(v)) return ''
  const d = decimals ?? 6
  const fixed = parseFloat(v.toFixed(d))
  return String(fixed)
}

/**
 * 数字输入的"缓冲文本"逻辑：输入框聚焦时只维护本地字符串，允许 ""/"-"/"1." 这类
 * 打字中间态，不会被外部 value 或 clamp 打断；失焦/回车时才最终解析+限位+回写。
 * 这是修复"打字打到一半被强制吸回最小值/清空"这类"某某参数无法设置"问题的根因所在。
 */
function useBufferedNumber(
  value: number,
  onChange: (v: number) => void,
  opts: { min?: number; max?: number; decimals?: number }
): {
  text: string
  onFocus: () => void
  onChangeText: (raw: string) => void
  onBlur: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  step: (dir: 1 | -1, amount: number) => void
} {
  const [text, setText] = useState(() => formatNum(value, opts.decimals))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(formatNum(value, opts.decimals))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, opts.decimals, focused])

  const commit = (raw: string): void => {
    const n = parseFloat(raw)
    if (Number.isFinite(n)) {
      const c = clamp(n, opts.min, opts.max)
      onChange(c)
      setText(formatNum(c, opts.decimals))
    } else {
      setText(formatNum(value, opts.decimals)) // 无效输入：还原为上一个有效值，而不是强行吸到 min
    }
  }

  return {
    text,
    onFocus: () => setFocused(true),
    onChangeText: (raw) => {
      setText(raw)
      // 只有输入本身已是"完整合法数字"时才实时回传给外部（驱动地图预览等联动）；
      // ""、"-"、"1." 这类中间态留在本地缓冲区里，不打扰外部状态。
      if (/^-?\d+\.?\d*$/.test(raw)) {
        const n = parseFloat(raw)
        if (Number.isFinite(n)) onChange(clamp(n, opts.min, opts.max))
      }
    },
    onBlur: () => {
      setFocused(false)
      commit(text)
    },
    onKeyDown: (e) => {
      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
    },
    step: (dir, amount) => {
      const cur = Number.isFinite(parseFloat(text)) ? parseFloat(text) : value
      const next = clamp(Math.round((cur + dir * amount) * 1e6) / 1e6, opts.min, opts.max)
      onChange(next)
      setText(formatNum(next, opts.decimals))
    }
  }
}

export function NumberInput({
  value,
  onChange,
  step = 1,
  min,
  max,
  unit,
  disabled,
  decimals
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  unit?: string
  disabled?: boolean
  /** 显示精度（小数位）；经纬度等长小数字段建议传 6~7，避免出现十几位小数。 */
  decimals?: number
}) {
  const buf = useBufferedNumber(value, onChange, { min, max, decimals })
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', opacity: disabled ? 0.45 : 1 }}>
      <input
        className="m-fld"
        type="text"
        inputMode="decimal"
        value={buf.text}
        disabled={disabled}
        onFocus={buf.onFocus}
        onChange={(e) => buf.onChangeText(e.target.value)}
        onBlur={buf.onBlur}
        onKeyDown={buf.onKeyDown}
        style={{ paddingRight: unit ? 66 : 46 }}
      />
      {unit && (
        <span style={{ position: 'absolute', right: 46, fontSize: 11, color: 'var(--text-lo)', pointerEvents: 'none' }}>
          {unit}
        </span>
      )}
      {/* 原生 spinner 箭头太小难点中（反馈原文），改用更大的自绘 +/- 按钮 */}
      <div style={{ position: 'absolute', right: 3, display: 'flex', gap: 2 }}>
        <button
          type="button"
          tabIndex={-1}
          className="m-stepper"
          disabled={disabled}
          onClick={() => buf.step(-1, step)}
          aria-label="减少"
        >
          <Icon name="minus" size={12} />
        </button>
        <button
          type="button"
          tabIndex={-1}
          className="m-stepper"
          disabled={disabled}
          onClick={() => buf.step(1, step)}
          aria-label="增加"
        >
          <Icon name="plus" size={12} />
        </button>
      </div>
    </div>
  )
}

/** 经纬度字段：十进制度 ⇄ 度分秒切换，限位到 [-90,90]/[-180,180]，支持南纬/西经负值。 */
export function LatLonField({
  label,
  axis,
  value,
  onChange
}: {
  label: string
  axis: 'lat' | 'lon'
  value: number
  onChange: (v: number) => void
}) {
  const [dms, setDms] = useState(false)
  const min = axis === 'lat' ? LIMITS.latMin : LIMITS.lonMin
  const max = axis === 'lat' ? LIMITS.latMax : LIMITS.lonMax
  const d = toDMS(Number.isFinite(value) ? value : 0, axis)

  const setPart = (patch: Partial<Dms>): void => {
    onChange(clamp(fromDMS({ ...d, ...patch }), min, max))
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <div className="label">{label}</div>
        <button
          type="button"
          className="btn ghost"
          style={{ padding: '2px 8px', fontSize: 10.5, height: 20, minHeight: 0 }}
          onClick={() => setDms((v) => !v)}
        >
          {dms ? '十进制' : '度分秒'}
        </button>
      </div>
      {dms ? (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <DmsPartInput value={d.deg} min={0} max={axis === 'lat' ? 90 : 180} onChange={(v) => setPart({ deg: v })} flex={1.1} />
          <DmsPartInput value={d.min} min={0} max={59} onChange={(v) => setPart({ min: v })} flex={1} />
          <DmsPartInput value={d.sec} min={0} max={59.999} decimals={1} onChange={(v) => setPart({ sec: v })} flex={1.3} />
          <select
            className="m-fld"
            style={{ width: 54, flexShrink: 0 }}
            value={d.hemi}
            onChange={(e) => setPart({ hemi: e.target.value as Dms['hemi'] })}
          >
            {(axis === 'lat' ? ['N', 'S'] : ['E', 'W']).map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
      ) : (
        // 十进制经纬度只显示 7 位小数（约 1cm 精度），避免 bearing/destination 计算带来的十几位小数
        <NumberInput value={value} step={0.000001} min={min} max={max} decimals={7} onChange={onChange} />
      )}
    </div>
  )
}

/** 度分秒编辑器里的单个数字格（度/分/秒），复用缓冲输入逻辑避免打字被清空/吸到 0。 */
function DmsPartInput({
  value,
  min,
  max,
  decimals = 0,
  flex,
  onChange
}: {
  value: number
  min: number
  max: number
  decimals?: number
  flex: number
  onChange: (v: number) => void
}) {
  const buf = useBufferedNumber(value, onChange, { min, max, decimals })
  return (
    <input
      className="m-fld"
      type="text"
      inputMode="decimal"
      style={{ width: 0, flex }}
      value={buf.text}
      onFocus={buf.onFocus}
      onChange={(e) => buf.onChangeText(e.target.value)}
      onBlur={buf.onBlur}
      onKeyDown={buf.onKeyDown}
    />
  )
}

export function TextInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input className="m-fld" value={value} onChange={(e) => onChange(e.target.value)} />
}

export function Select<T extends string | number>({
  value,
  onChange,
  options
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; disabled?: boolean }[]
}) {
  return (
    <select
      className="m-fld"
      value={String(value)}
      onChange={(e) => {
        const raw = e.target.value
        const opt = options.find((o) => String(o.value) === raw)!
        onChange(opt.value)
      }}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 999,
        background: value ? 'var(--primary-deep)' : 'var(--bg-3)',
        border: '1px solid var(--stroke)',
        position: 'relative',
        transition: 'background .15s'
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: value ? 22 : 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: value ? 'var(--primary)' : 'var(--text-lo)',
          transition: 'left .15s',
          boxShadow: value ? '0 0 8px var(--primary-glow)' : 'none'
        }}
      />
    </button>
  )
}

export function ToggleRow({
  label,
  value,
  onChange
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <span style={{ fontSize: 13, color: 'var(--text-mid)' }}>{label}</span>
      <Toggle value={value} onChange={onChange} />
    </div>
  )
}

/** 通用弹窗外壳 */
export function Dialog({
  title,
  onClose,
  width = 380,
  children,
  footer
}: {
  title: string
  onClose: () => void
  width?: number
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(4,7,13,0.55)',
        backdropFilter: 'blur(3px)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 120
      }}
    >
      <div className="panel" onClick={(e) => e.stopPropagation()} style={{ width, padding: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '13px 16px',
            borderBottom: '1px solid var(--stroke)'
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 14.5 }}>{title}</span>
          <div style={{ flex: 1 }} />
          <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={onClose}>
            <Icon name="close" size={15} />
          </button>
        </div>
        <div style={{ padding: 16, maxHeight: '68vh', overflowY: 'auto' }}>{children}</div>
        {footer && (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '0 16px 16px' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export const fieldStyles = `
  .m-fld{width:100%;padding:8px 10px;border-radius:var(--r-sm);border:1px solid var(--stroke);
    background:var(--bg-0);color:var(--text-hi);font-size:13.5px;font-family:var(--font-ui);outline:none}
  .m-fld:focus{border-color:var(--primary);box-shadow:0 0 0 1px var(--primary-dim)}
  input.m-fld[inputmode=decimal]{font-family:var(--font-num)}
  .m-stepper{width:20px;height:24px;display:grid;place-items:center;border-radius:4px;
    color:var(--text-mid);background:var(--bg-2);border:1px solid var(--stroke-soft)}
  .m-stepper:hover{color:var(--primary);border-color:var(--primary)}
  .m-stepper:active{background:var(--primary-dim)}
  .m-stepper:disabled{opacity:.4;pointer-events:none}
`
