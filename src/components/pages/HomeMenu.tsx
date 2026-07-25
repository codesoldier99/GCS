import { useState } from 'react'
import type { IconName } from '../Icon'
import { Icon } from '../Icon'
import { useUi, type Route } from '../../state/uiStore'
import { C } from '../../theme/tokens'
import logoFull from '../../assets/logo-full.png'

interface Card {
  route: Route
  title: string
  desc: string
  icon: IconName
  color: string
}

// 卡片强调色取自 theme/tokens.ts（与 peugeot.css 的 CSS 变量同源），
// 而非在组件里硬编码，同时满足这里需要做十六进制透明度拼接（如 `${c.color}22`）的 JS 侧用法。
const CARDS: Card[] = [
  { route: 'manual', title: '手动飞行', desc: '实时遥测 · 姿态球 · 一键起降返航', icon: 'manual', color: C.primary },
  { route: 'mission', title: '航线飞行', desc: '航点规划 · 模板 · 上传/下载航线', icon: 'route', color: C.success },
  { route: 'wizard', title: '装机向导', desc: '机架 · 电机测试 · 校准 · 安全项', icon: 'wizard', color: C.primaryDeep },
  { route: 'caac', title: 'CAAC 训练', desc: '绕八字 · 电子桩 · 考试科目', icon: 'caac', color: C.accent },
  { route: 'tuning', title: '飞控调参', desc: '参数读写 · 安全设置 · 固件升级', icon: 'tuning', color: C.danger },
  { route: 'sim', title: '模拟飞行', desc: '内置仿真 · 无需真机即可练习', icon: 'sim', color: C.catSim }
]

export function HomeMenu(): JSX.Element {
  const go = useUi((s) => s.go)
  const openConnect = useUi((s) => s.openConnect)
  const [hover, setHover] = useState<Route | null>(null)

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 34 }}>
        <img
          src={logoFull}
          alt="中影智能"
          style={{
            height: 52,
            marginBottom: 18,
            filter:
              'drop-shadow(0 0 22px rgba(23,212,230,0.3)) drop-shadow(0 2px 10px rgba(0,0,0,0.5)) brightness(1.18) contrast(1.08)'
          }}
        />
        <div
          className="label"
          style={{ color: 'var(--primary)', letterSpacing: '0.4em', marginBottom: 10 }}
        >
          UAV GROUND CONTROL · 无人机培训地面站
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textShadow: '0 0 24px rgba(23,212,230,0.25)'
          }}
        >
          欢迎使用 <span className="glow">中影智能地面站</span>
        </h1>
        <div style={{ color: 'var(--text-mid)', marginTop: 8, fontSize: 14 }}>
          连接 APM / ArduPilot 飞控（X6PRO）· 面向学员的教学与考试训练
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 260px)',
          gap: 20,
          maxWidth: 840
        }}
      >
        {CARDS.map((c) => (
          <button
            key={c.route}
            className="panel"
            onMouseEnter={() => setHover(c.route)}
            onMouseLeave={() => setHover(null)}
            onClick={() => go(c.route)}
            style={{
              textAlign: 'left',
              padding: 22,
              height: 156,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              transform: hover === c.route ? 'translateY(-4px)' : 'none',
              borderColor: hover === c.route ? c.color : 'var(--stroke)',
              boxShadow:
                hover === c.route
                  ? `inset 0 1px 0 var(--stroke-hi), 0 20px 44px rgba(0,0,0,0.55), 0 0 0 1px ${c.color}40`
                  : undefined,
              transition: 'transform .18s ease, border-color .18s, box-shadow .18s'
            }}
          >
            <div
              style={{
                position: 'absolute',
                right: -30,
                top: -30,
                width: 120,
                height: 120,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${c.color}22, transparent 70%)`,
                opacity: hover === c.route ? 1 : 0.5,
                transition: 'opacity .2s'
              }}
            />
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                display: 'grid',
                placeItems: 'center',
                background: `linear-gradient(180deg, ${c.color}28, ${c.color}10)`,
                border: `1px solid ${c.color}55`,
                color: c.color,
                boxShadow: hover === c.route ? `0 0 16px ${c.color}55` : 'none'
              }}
            >
              <Icon name={c.icon} size={26} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{c.title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-mid)', lineHeight: 1.5 }}>{c.desc}</div>
          </button>
        ))}
      </div>

      <button className="btn primary" style={{ marginTop: 30, padding: '11px 28px' }} onClick={openConnect}>
        <Icon name="link" size={18} /> 连接无人机 / 选择数据源
      </button>
    </div>
  )
}
