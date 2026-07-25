import { Icon } from '../Icon'
import { useUi } from '../../state/uiStore'
import { C } from '../../theme/tokens'
import { playCue } from '../../audio/engine'
import { RingMenu, type RingItem } from './RingMenu'

// 强调色取自 theme/tokens.ts（与 peugeot.css 的 CSS 变量同源），
// 而非在组件里硬编码，同时满足这里需要做十六进制透明度拼接（如 `${color}88`）的 JS 侧用法。
const ITEMS: RingItem[] = [
  { route: 'manual', title: '手动飞行', desc: '实时遥测 · 姿态球 · 一键起降返航', icon: 'manual', color: C.primary },
  { route: 'mission', title: '航线飞行', desc: '航点规划 · 模板 · 上传/下载航线', icon: 'route', color: C.success },
  { route: 'wizard', title: '装机向导', desc: '机架 · 电机测试 · 校准 · 安全项', icon: 'wizard', color: C.primaryDeep },
  { route: 'sim', title: '模拟飞行', desc: '内置仿真 · 无需真机即可练习', icon: 'sim', color: C.catSim },
  { route: 'tuning', title: '飞控调参', desc: '参数读写 · 安全设置 · 固件升级', icon: 'tuning', color: C.danger },
  { route: 'caac', title: 'CAAC 训练', desc: '绕八字 · 电子桩 · 考试科目', icon: 'caac', color: C.accent }
]

export function HomeMenu(): JSX.Element {
  const go = useUi((s) => s.go)
  const openConnect = useUi((s) => s.openConnect)

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'clamp(10px, 2.4vh, 26px)',
        padding: '16px 32px'
      }}
    >
      <div
        className="label"
        style={{ color: 'var(--primary)', letterSpacing: '0.42em', textAlign: 'center' }}
      >
        UAV GROUND CONTROL · 无人机培训地面站
      </div>

      <RingMenu items={ITEMS} onSelect={go} />

      <button
        className="btn primary flow"
        style={{ padding: '11px 28px', borderRadius: 'var(--r-pill)' }}
        onClick={() => {
          playCue('select')
          openConnect()
        }}
        onMouseEnter={() => playCue('hover')}
      >
        <Icon name="link" size={18} /> 连接无人机 / 选择数据源
      </button>
    </div>
  )
}
