import type { TurnMode } from '@shared/mission'

/** 转弯模式选项：悬停转弯（到点即停）/ 协调转弯（不停顿掠过）/ 自适应协调转弯（样条平滑过渡）。 */
export const TURN_OPTS: { value: TurnMode; label: string }[] = [
  { value: 'stop', label: '悬停转弯' },
  { value: 'coordinated', label: '协调转弯' },
  { value: 'adaptive', label: '自适应协调转弯' }
]
