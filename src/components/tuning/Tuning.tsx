import { useEffect, useMemo, useState } from 'react'
import { useParams } from '../../state/paramStore'
import { useLink } from '../../state/linkStore'
import { useUi } from '../../state/uiStore'
import { groupOf } from '../../mavlink/params'
import { Icon } from '../Icon'
import { fieldStyles } from '../mission/fields'

type Tab = 'params' | 'firmware'

export function Tuning(): JSX.Element {
  const [tab, setTab] = useState<Tab>('params')
  const go = useUi((s) => s.go)

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 22px',
          borderBottom: '1px solid var(--stroke)',
          background: 'rgba(11,17,30,0.6)'
        }}
      >
        <Icon name="tuning" size={20} style={{ color: 'var(--primary)' }} />
        <span style={{ fontWeight: 700, fontSize: 15, marginRight: 10 }}>飞控调参</span>
        {(['params', 'firmware'] as Tab[]).map((t) => (
          <button
            key={t}
            className="btn"
            onClick={() => setTab(t)}
            style={{
              padding: '6px 14px',
              background: tab === t ? 'var(--primary-dim)' : 'transparent',
              borderColor: tab === t ? 'var(--primary)' : 'var(--stroke)',
              color: tab === t ? 'var(--primary)' : 'var(--text-mid)'
            }}
          >
            {t === 'params' ? '参数总表' : '固件升级'}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={() => go('home')}>
          <Icon name="home" size={16} /> 主菜单
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {tab === 'params' ? <ParamTable /> : <Firmware />}
      </div>
      <style>{fieldStyles}</style>
    </div>
  )
}

function ParamTable(): JSX.Element {
  const params = useParams((s) => s.params)
  const loaded = useParams((s) => s.loaded)
  const loading = useParams((s) => s.loading)
  const progress = useParams((s) => s.progress)
  const load = useParams((s) => s.load)
  const connected = useLink((s) => s.status.state === 'connected')
  const [q, setQ] = useState('')

  useEffect(() => {
    if (connected && !loaded && !loading) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected])

  const rows = useMemo(() => {
    const list = Object.entries(params)
      .map(([id, value]) => ({ id, value, group: groupOf(id) }))
      .filter((r) => !q || r.id.toLowerCase().includes(q.toLowerCase()) || r.group.includes(q))
      .sort((a, b) => a.id.localeCompare(b.id))
    return list
  }, [params, q])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 22px' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 380 }}>
          <input
            className="m-fld"
            placeholder="搜索参数名或分组…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
          <Icon name="target" size={15} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-lo)' }} />
        </div>
        <span style={{ fontSize: 12.5, color: 'var(--text-lo)' }}>{rows.length} 项</span>
        <div style={{ flex: 1 }} />
        <button className="btn" disabled={loading} onClick={() => load()}>
          <Icon name="download" size={15} /> {loaded ? '重新读取' : '读取参数'}
        </button>
      </div>

      {loading && progress && (
        <div style={{ padding: '0 22px 8px' }}>
          <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
            <div style={{ width: `${(progress.received / Math.max(1, progress.total)) * 100}%`, height: '100%', background: 'var(--primary)' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-lo)', marginTop: 4 }}>读取参数 {progress.received}/{progress.total || '…'}</div>
        </div>
      )}

      {!loaded && !loading && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-mid)' }}>
          {connected ? '点击「读取参数」加载飞控参数。' : '未连接飞控/仿真，连接后可读取并修改参数。'}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 22px 22px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 1 }}>
          {rows.map((r) => (
            <ParamRow key={r.id} id={r.id} value={r.value} group={r.group} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ParamRow({ id, value, group }: { id: string; value: number; group: string }): JSX.Element {
  const setParam = useParams((s) => s.setParam)
  const [local, setLocal] = useState(String(value))
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setLocal(String(value))
    setDirty(false)
  }, [value])

  const commit = (): void => {
    const v = parseFloat(local)
    if (Number.isFinite(v) && v !== value) setParam(id, v)
    setDirty(false)
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '260px 90px 1fr 84px',
        alignItems: 'center',
        gap: 12,
        padding: '7px 12px',
        borderBottom: '1px solid var(--stroke-soft)'
      }}
    >
      <span className="readout" style={{ fontSize: 13, color: 'var(--text-hi)' }}>{id}</span>
      <span style={{ fontSize: 11, color: 'var(--text-lo)' }}>{group}</span>
      <input
        className="m-fld"
        value={local}
        onChange={(e) => { setLocal(e.target.value); setDirty(true) }}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        style={{ maxWidth: 200 }}
      />
      <button
        className="btn"
        disabled={!dirty}
        onClick={commit}
        style={{ padding: '6px 0', borderColor: dirty ? 'var(--primary)' : 'var(--stroke)', color: dirty ? 'var(--primary)' : 'var(--text-lo)' }}
      >
        写入
      </button>
    </div>
  )
}

function Firmware(): JSX.Element {
  const [file, setFile] = useState<string | null>(null)
  const [flashing, setFlashing] = useState(false)
  const [pct, setPct] = useState(0)

  const startFlash = (): void => {
    // 真实烧录需经 USB/bootloader，此处为教学演示流程
    setFlashing(true)
    setPct(0)
    const iv = setInterval(() => {
      setPct((p) => {
        if (p >= 100) { clearInterval(iv); setFlashing(false); return 100 }
        return p + 4
      })
    }, 120)
  }

  return (
    <div style={{ padding: 26, height: '100%', display: 'grid', placeItems: 'center' }}>
      <div className="panel" style={{ width: 560, padding: 28 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div
            style={{
              width: 74, height: 74, margin: '0 auto 14px', borderRadius: 18, display: 'grid', placeItems: 'center',
              border: '1px dashed var(--stroke)', color: 'var(--primary)'
            }}
          >
            <Icon name="upload" size={34} />
          </div>
          <h2 style={{ margin: '0 0 6px', fontSize: 19 }}>固件升级</h2>
          <div style={{ fontSize: 12.5, color: 'var(--text-mid)' }}>
            通过 USB 连接飞控，选择 <code>.lkiso</code> 固件文件进行升级。升级过程请勿断电或拔线。
          </div>
        </div>

        <label
          className="btn"
          style={{ width: '100%', justifyContent: 'center', padding: '11px 0', marginBottom: 12, cursor: 'pointer' }}
        >
          <Icon name="save" size={16} /> {file ?? '选择本地固件文件（.lkiso）'}
          <input
            type="file"
            accept=".lkiso,.bin,.apj"
            style={{ display: 'none' }}
            onChange={(e) => setFile(e.target.files?.[0]?.name ?? null)}
          />
        </label>

        {flashing || pct > 0 ? (
          <div style={{ marginBottom: 12 }}>
            <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: pct >= 100 ? 'var(--success)' : 'var(--primary)', transition: 'width .12s' }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-mid)', marginTop: 6 }}>
              {pct >= 100 ? '固件升级完成，等待飞控指示灯恢复正常闪烁。' : `烧录中… ${pct}%（请勿断电）`}
            </div>
          </div>
        ) : null}

        <button className="btn primary" style={{ width: '100%', padding: '11px 0' }} disabled={!file || flashing} onClick={startFlash}>
          <Icon name="play" size={16} /> 开始更新
        </button>

        <div style={{ fontSize: 11.5, color: 'var(--text-lo)', marginTop: 14, lineHeight: 1.6 }}>
          说明：实际烧录需飞控进入 bootloader 并通过 USB 通信，需在真机环境下进行；此处演示升级流程与界面。
        </div>
      </div>
    </div>
  )
}
