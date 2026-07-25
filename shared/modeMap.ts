import type { FlightMode } from './telemetry'

/** ArduCopter 飞行模式：custom_mode 数值 → 中文名/英文码。与 X6PRO 手册一致。 */
export const COPTER_MODES: Record<number, { label: string; code: string }> = {
  0: { label: '姿态模式', code: 'STABILIZE' },
  1: { label: '特技', code: 'ACRO' },
  2: { label: '定高', code: 'ALT_HOLD' },
  3: { label: '自动模式', code: 'AUTO' },
  4: { label: '指引模式', code: 'GUIDED' },
  5: { label: 'GPS模式', code: 'LOITER' },
  6: { label: '返航模式', code: 'RTL' },
  7: { label: '绕圈', code: 'CIRCLE' },
  9: { label: '降落模式', code: 'LAND' },
  16: { label: '定点', code: 'POSHOLD' },
  17: { label: '刹车', code: 'BRAKE' },
  20: { label: '起飞', code: 'GUIDED_NOGPS' }
}

/** 供飞行模式菜单使用（学员常用集合，顺序即展示顺序）。 */
export const SELECTABLE_MODES: number[] = [0, 2, 5, 16, 4, 3, 6, 9]

export function modeById(id: number): FlightMode {
  const m = COPTER_MODES[id] ?? { label: `模式${id}`, code: `MODE_${id}` }
  return { id, label: m.label, code: m.code }
}
