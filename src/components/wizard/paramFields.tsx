import { useEffect, useState } from 'react'
import { useParams } from '../../state/paramStore'
import type { EnumOpt } from '../../mavlink/params'
import { Field, NumberInput, Select, Toggle } from '../mission/fields'

/** 参数数值字段：读 paramStore，失焦/回车写入。scale 用于单位换算（如 cm→m 用 scale=100） */
export function ParamNumber({
  id,
  label,
  unit,
  scale = 1,
  step = 1,
  min,
  max,
  fallback = 0,
  hint
}: {
  id: string
  label: string
  unit?: string
  scale?: number
  step?: number
  min?: number
  max?: number
  fallback?: number
  hint?: string
}) {
  const raw = useParams((s) => (s.params[id] ?? fallback))
  const setParam = useParams((s) => s.setParam)
  const [local, setLocal] = useState<number>(raw / scale)

  useEffect(() => setLocal(raw / scale), [raw, scale])

  return (
    <Field label={label} hint={hint ?? id}>
      <NumberInput
        value={local}
        step={step}
        min={min}
        max={max}
        unit={unit}
        onChange={(v) => {
          setLocal(v)
          if (Number.isFinite(v)) setParam(id, v * scale)
        }}
      />
    </Field>
  )
}

export function ParamEnum({
  id,
  label,
  options,
  fallback = 0
}: {
  id: string
  label: string
  options: EnumOpt[]
  fallback?: number
}) {
  const raw = useParams((s) => (s.params[id] ?? fallback))
  const setParam = useParams((s) => s.setParam)
  return (
    <Field label={label} hint={id}>
      <Select
        value={raw}
        onChange={(v) => setParam(id, v)}
        options={options.map((o) => ({ value: o.value, label: o.label }))}
      />
    </Field>
  )
}

export function ParamToggle({
  id,
  label,
  on = 1,
  off = 0,
  fallback = 0
}: {
  id: string
  label: string
  on?: number
  off?: number
  fallback?: number
}) {
  const raw = useParams((s) => (s.params[id] ?? fallback))
  const setParam = useParams((s) => s.setParam)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div>
        <div style={{ fontSize: 13.5 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-lo)' }}>{id}</div>
      </div>
      <Toggle value={raw === on} onChange={(v) => setParam(id, v ? on : off)} />
    </div>
  )
}
