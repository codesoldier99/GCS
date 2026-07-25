// 装机向导/调参用到的参数枚举与选项（ArduCopter）。

export interface EnumOpt {
  value: number
  label: string
}

export const FRAME_CLASS: EnumOpt[] = [
  { value: 1, label: '四轴 (Quad)' },
  { value: 2, label: '六轴 (Hexa)' },
  { value: 3, label: '八轴 (Octa)' },
  { value: 4, label: '八轴四臂 (OctaQuad)' }
]

export const FRAME_TYPE: EnumOpt[] = [
  { value: 0, label: '+ 字形' },
  { value: 1, label: 'X 字形' },
  { value: 2, label: 'V 字形' },
  { value: 3, label: 'H 字形' }
]

/** 每种机架的电机数量（用于电机测试） */
export const FRAME_MOTORS: Record<number, number> = { 1: 4, 2: 6, 3: 8, 4: 8 }

export const FS_ACTION: EnumOpt[] = [
  { value: 0, label: '无动作' },
  { value: 1, label: '降落' },
  { value: 2, label: '返航' },
  { value: 3, label: 'SmartRTL' }
]

export const FENCE_ACTION: EnumOpt[] = [
  { value: 0, label: '仅报告' },
  { value: 1, label: '返航或降落' },
  { value: 2, label: '始终降落' },
  { value: 4, label: '刹车' }
]

export const FS_THR: EnumOpt[] = [
  { value: 0, label: '禁用' },
  { value: 1, label: '返航' },
  { value: 2, label: '继续任务' },
  { value: 3, label: '降落' },
  { value: 4, label: 'SmartRTL' }
]

export const AHRS_ORIENTATION: EnumOpt[] = [
  { value: 0, label: 'None（默认）' },
  { value: 2, label: 'Yaw 90°' },
  { value: 4, label: 'Yaw 180°' },
  { value: 6, label: 'Yaw 270°' },
  { value: 8, label: 'Roll 180°' }
]

export const FLIGHT_MODES: EnumOpt[] = [
  { value: 0, label: '姿态模式' },
  { value: 2, label: '定高' },
  { value: 5, label: 'GPS模式' },
  { value: 16, label: '定点' },
  { value: 6, label: '返航模式' },
  { value: 3, label: '自动模式' },
  { value: 9, label: '降落模式' },
  { value: 4, label: '指引模式' }
]

/** 调参页参数分组前缀 → 中文名（用于分组展示） */
export const PARAM_GROUPS: { prefix: string; label: string }[] = [
  { prefix: 'FRAME', label: '机架' },
  { prefix: 'RTL', label: '返航' },
  { prefix: 'WPNAV', label: '航点导航' },
  { prefix: 'BATT', label: '电池/电压' },
  { prefix: 'FENCE', label: '电子围栏' },
  { prefix: 'FS_', label: '失控保护' },
  { prefix: 'FLTMODE', label: '飞行模式' },
  { prefix: 'AHRS', label: '姿态参考' },
  { prefix: 'INS', label: '惯性传感器' },
  { prefix: 'GPS', label: 'GPS' },
  { prefix: 'COMPASS', label: '罗盘' },
  { prefix: 'ATC', label: '姿态控制' },
  { prefix: 'MOT', label: '电机' },
  { prefix: 'RC', label: '遥控通道' },
  { prefix: 'PILOT', label: '手动限速' },
  { prefix: 'SR', label: '数据流' },
  { prefix: 'SERIAL', label: '串口' }
]

export function groupOf(id: string): string {
  const g = PARAM_GROUPS.find((x) => id.startsWith(x.prefix))
  return g ? g.label : '其他'
}
