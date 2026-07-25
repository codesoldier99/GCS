import { useState, type ReactNode } from 'react'
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

export function NumberInput({
  value,
  onChange,
  step = 1,
  min,
  max,
  unit,
  suffix,
  disabled
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  unit?: string
  suffix?: ReactNode
  disabled?: boolean
}) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', opacity: disabled ? 0.45 : 1 }}>
      <input
        className="m-fld"
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        // 原生 <input type=number> 的 min/max 只影响步进箭头与校验样式，不阻止直接键入越界值；
        // 这里在 onChange 时真正 clamp 到范围内，才能满足"超出数值无法输入"的限位要求。
        onChange={(e) => {
          const raw = parseFloat(e.target.value)
          onChange(Number.isFinite(raw) ? clamp(raw, min, max) : (min ?? 0))
        }}
      />
      {unit && (
        <span style={{ position: 'absolute', right: suffix ? 34 : 10, fontSize: 11, color: 'var(--text-lo)' }}>
          {unit}
        </span>
      )}
      {suffix}
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
          <input
            className="m-fld"
            type="number"
            style={{ width: 0, flex: 1.1 }}
            value={d.deg}
            onChange={(e) => setPart({ deg: clamp(parseFloat(e.target.value) || 0, 0, axis === 'lat' ? 90 : 180) })}
          />
          <input
            className="m-fld"
            type="number"
            style={{ width: 0, flex: 1 }}
            value={d.min}
            onChange={(e) => setPart({ min: clamp(parseFloat(e.target.value) || 0, 0, 59) })}
          />
          <input
            className="m-fld"
            type="number"
            step={0.1}
            style={{ width: 0, flex: 1.3 }}
            value={+d.sec.toFixed(1)}
            onChange={(e) => setPart({ sec: clamp(parseFloat(e.target.value) || 0, 0, 59.999) })}
          />
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
        <NumberInput value={value} step={0.000001} min={min} max={max} onChange={onChange} />
      )}
    </div>
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
  options: { value: T; label: string }[]
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
        <option key={String(o.value)} value={String(o.value)}>
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
  input.m-fld[type=number]{font-family:var(--font-num)}
`
