import { shouldReduceMotion } from '../state/settingsStore'

export const EASE_OUT = 'cubic-bezier(.16, 1, .3, 1)'

/**
 * WAAPI 动画封装：尊重「精简动效」设置与系统 prefers-reduced-motion，
 * 关闭动效时直接跳到终态而不是播放动画。
 */
export function animateEl(
  el: Element | null,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions
): Animation | null {
  if (!el || typeof el.animate !== 'function') return null
  if (shouldReduceMotion()) {
    // 只应用最后一帧，保证布局/可见性正确
    return el.animate([keyframes[keyframes.length - 1]], { duration: 0, fill: 'both' })
  }
  return el.animate(keyframes, { easing: EASE_OUT, fill: 'both', ...options })
}

/**
 * 用 View Transitions API 包裹一次状态切换，得到页面级 morph 过渡。
 * 浏览器不支持或用户关闭动效时，退化为直接切换。
 */
export function withViewTransition(mutate: () => void): void {
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { finished: Promise<void> }
  }
  if (shouldReduceMotion() || typeof doc.startViewTransition !== 'function') {
    mutate()
    return
  }
  doc.startViewTransition(mutate)
}
