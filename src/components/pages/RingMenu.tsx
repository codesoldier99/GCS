import { useEffect, useRef, useState } from 'react'
import { ICON_PATHS, type IconName } from '../Icon'
import type { Route } from '../../state/uiStore'
import { C } from '../../theme/tokens'
import { animateEl } from '../../util/motion'
import { playCue } from '../../audio/engine'
// 深色背景专用版 logo：保留品牌双色蓝的色相，仅提亮明度，
// 否则原印刷版的深蓝拼音在近黑蓝底上几乎不可见。
import logoFull from '../../assets/logo-full-light.png'

export interface RingItem {
  route: Route
  title: string
  desc: string
  icon: IconName
  color: string
}

/* ---------- 几何：极坐标环形扇区 ---------- */

const VIEW = 620
const CX = VIEW / 2
const CY = VIEW / 2
const R_IN = 178
const R_OUT = 288
const R_ICON = (R_IN + R_OUT) / 2
const GAP_DEG = 3.6 // 扇区间隙

const rad = (d: number): number => (d * Math.PI) / 180

function polar(r: number, aDeg: number): [number, number] {
  const a = rad(aDeg)
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)]
}

/** 环形扇区路径（外弧顺时针 → 内弧逆时针闭合） */
function annularSector(r1: number, r2: number, a0: number, a1: number): string {
  const [x0, y0] = polar(r2, a0)
  const [x1, y1] = polar(r2, a1)
  const [x2, y2] = polar(r1, a1)
  const [x3, y3] = polar(r1, a0)
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0
  return `M ${x0} ${y0} A ${r2} ${r2} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${r1} ${r1} 0 ${large} 0 ${x3} ${y3} Z`
}

/* ---------- 组件 ---------- */

export function RingMenu({ items, onSelect }: { items: RingItem[]; onSelect: (r: Route) => void }): JSX.Element {
  const [active, setActive] = useState<number | null>(null)
  const petalRefs = useRef<(SVGGElement | null)[]>([])
  const centerRef = useRef<HTMLDivElement>(null)
  const n = items.length
  const step = 360 / n

  // 入场：各扇区从中心向外「就位」，交错展开
  useEffect(() => {
    petalRefs.current.forEach((el, i) => {
      const mid = -90 + i * step
      const [dx, dy] = [Math.cos(rad(mid)) * 26, Math.sin(rad(mid)) * 26]
      animateEl(
        el,
        [
          { opacity: 0, transform: `translate(${-dx}px, ${-dy}px)` },
          { opacity: 1, transform: 'translate(0px, 0px)' }
        ],
        { duration: 460, delay: 80 + i * 65 }
      )
    })
    animateEl(centerRef.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 80 + n * 65 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hoverItem = (i: number | null): void => {
    if (i !== null && i !== active) playCue('hover')
    setActive(i)
  }

  const choose = (i: number): void => {
    playCue('select')
    onSelect(items[i].route)
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      hoverItem(((active ?? -1) + 1 + n) % n)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      hoverItem(((active ?? 1) - 1 + n) % n)
    } else if ((e.key === 'Enter' || e.key === ' ') && active !== null) {
      e.preventDefault()
      choose(active)
    } else if (e.key === 'Escape') {
      hoverItem(null)
    }
  }

  const cur = active !== null ? items[active] : null

  return (
    <div
      role="menu"
      tabIndex={0}
      aria-label="功能主菜单"
      onKeyDown={onKeyDown}
      onMouseLeave={() => setActive(null)}
      style={{
        position: 'relative',
        width: 'min(560px, 56vh, 52vw)',
        aspectRatio: '1 / 1',
        outline: 'none'
      }}
    >
      <svg viewBox={`0 0 ${VIEW} ${VIEW}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
        <defs>
          {items.map((it, i) => (
            <radialGradient key={i} id={`ring-fill-${i}`} cx="50%" cy="50%" r="50%">
              <stop offset="55%" stopColor={it.color} stopOpacity={0.05} />
              <stop offset="100%" stopColor={it.color} stopOpacity={0.3} />
            </radialGradient>
          ))}
        </defs>

        <DecorRing />

        {items.map((it, i) => {
          const mid = -90 + i * step
          const a0 = mid - step / 2 + GAP_DEG / 2
          const a1 = mid + step / 2 - GAP_DEG / 2
          const on = active === i
          const [ox, oy] = [Math.cos(rad(mid)) * 9, Math.sin(rad(mid)) * 9]
          const [ix, iy] = polar(R_ICON, mid)

          return (
            // 外层 g 负责入场动画（WAAPI），内层 g 负责悬停位移（CSS 过渡），
            // 分开以免两者争抢同一个 transform 属性。
            <g key={it.route} ref={(el) => (petalRefs.current[i] = el)}>
              <g
                role="menuitem"
                aria-label={it.title}
                onMouseEnter={() => hoverItem(i)}
                onClick={() => choose(i)}
                style={{
                  cursor: 'pointer',
                  transform: on ? `translate(${ox}px, ${oy}px)` : 'translate(0px, 0px)',
                  transition: 'transform var(--dur) var(--ease-out)',
                  filter: on ? `drop-shadow(0 0 16px ${it.color}88)` : 'none'
                }}
              >
                <path
                  d={annularSector(R_IN, R_OUT, a0, a1)}
                  fill={on ? `url(#ring-fill-${i})` : 'rgba(16, 24, 42, 0.72)'}
                  stroke={on ? it.color : C.stroke}
                  strokeWidth={on ? 1.8 : 1}
                  style={{ transition: 'fill var(--dur), stroke var(--dur), stroke-width var(--dur)' }}
                />
                {/* 外缘高亮弧：选中项的"能量条" */}
                <path
                  d={annularSector(R_OUT - 5, R_OUT - 1.5, a0 + 1.5, a1 - 1.5)}
                  fill={it.color}
                  style={{ opacity: on ? 1 : 0.22, transition: 'opacity var(--dur)' }}
                />
                <g transform={`translate(${ix - 15}, ${iy - 30}) scale(1.25)`} style={{ pointerEvents: 'none' }}>
                  <path
                    d={ICON_PATHS[it.icon]}
                    fill="none"
                    stroke={on ? it.color : C.textMid}
                    strokeWidth={1.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ transition: 'stroke var(--dur)' }}
                  />
                </g>
                <text
                  x={ix}
                  y={iy + 30}
                  textAnchor="middle"
                  style={{
                    pointerEvents: 'none',
                    fill: on ? C.textHi : C.textMid,
                    font: '600 17px var(--font-ui)',
                    letterSpacing: '0.04em',
                    transition: 'fill var(--dur)'
                  }}
                >
                  {it.title}
                </text>
              </g>
            </g>
          )
        })}
      </svg>

      {/* 中心信息盘：未选中时显示品牌，悬停时显示该功能详情 */}
      <div
        ref={centerRef}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: `${(R_IN * 2 * 0.92) / VIEW * 100}%`,
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
          pointerEvents: 'none',
          padding: '0 4%'
        }}
      >
        {cur ? (
          <div key={cur.route}>
            <div
              style={{
                width: 40,
                height: 3,
                borderRadius: 2,
                background: cur.color,
                margin: '0 auto 12px',
                boxShadow: `0 0 12px ${cur.color}`
              }}
            />
            <div style={{ fontSize: 'clamp(18px, 3.4vh, 25px)', fontWeight: 700, letterSpacing: '0.04em' }}>
              {cur.title}
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 'clamp(11px, 1.6vh, 13px)',
                color: 'var(--text-mid)',
                lineHeight: 1.7
              }}
            >
              {cur.desc}
            </div>
          </div>
        ) : (
          <div>
            <img
              src={logoFull}
              alt="中影智能"
              style={{
                width: '82%',
                marginBottom: 14,
                filter: 'drop-shadow(0 0 26px rgba(23,212,230,0.28))'
              }}
            />
            <div
              className="label"
              style={{ color: 'var(--text-lo)', letterSpacing: '0.3em', fontSize: 'clamp(9px, 1.3vh, 11px)' }}
            >
              选择功能
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** 装饰环：刻度 + 缓慢旋转的扫描弧，呼应姿态球罗盘环的质感 */
function DecorRing(): JSX.Element {
  const ticks: JSX.Element[] = []
  for (let d = 0; d < 360; d += 5) {
    const major = d % 30 === 0
    const [x1, y1] = polar(R_OUT + 8, d)
    const [x2, y2] = polar(R_OUT + (major ? 21 : 14), d)
    ticks.push(
      <line
        key={d}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={major ? C.primary : C.textLo}
        // 次刻度描粗一点：viewBox 缩放到实际显示尺寸后，1px 会掉到亚像素而看不见
        strokeWidth={major ? 2 : 1.4}
        opacity={major ? 0.85 : 0.55}
      />
    )
  }
  const [sx, sy] = polar(R_OUT + 26, -90)
  return (
    <g style={{ pointerEvents: 'none' }}>
      <circle cx={CX} cy={CY} r={R_IN - 12} fill="none" stroke={C.stroke} strokeWidth={1} opacity={0.5} />
      {ticks}
      {/* 旋转扫描弧 */}
      <g className="ring-scan" style={{ transformBox: 'view-box', transformOrigin: `${CX}px ${CY}px` }}>
        <circle
          cx={CX}
          cy={CY}
          r={R_OUT + 26}
          fill="none"
          stroke={C.primary}
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeDasharray="70 1740"
          opacity={0.85}
        />
        <circle cx={sx} cy={sy} r={3} fill={C.primary} />
      </g>
    </g>
  )
}
