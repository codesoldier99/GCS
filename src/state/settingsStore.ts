import { create } from 'zustand'

const KEY = 'zy-gcs-settings'

export interface Settings {
  /** UI 交互音效总开关（教室多机同响时可一键静音） */
  soundOn: boolean
  /** UI 音效音量 0–1 */
  uiVolume: number
  /**
   * 飞行告警音量 0–1。独立于 UI 音效：即使关闭 UI 音效，告警仍会响，
   * 因为电压/失控告警属于安全信息，不应被界面静音顺带屏蔽。
   */
  alertVolume: number
  /** 精简动效：低配笔记本或前庭敏感用户可关闭动画 */
  reducedMotion: boolean
}

const DEFAULTS: Settings = {
  soundOn: true,
  uiVolume: 0.5,
  alertVolume: 0.8,
  reducedMotion: false
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    return { ...DEFAULTS }
  }
}

function save(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* 隐私模式/配额满：设置不持久化，不影响使用 */
  }
}

interface SettingsState extends Settings {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  reset: () => void
}

export const useSettings = create<SettingsState>((setState, get) => ({
  ...load(),
  set: (key, value) => {
    setState({ [key]: value } as Pick<SettingsState, typeof key>)
    const { set: _s, reset: _r, ...rest } = get()
    save(rest)
  },
  reset: () => {
    setState({ ...DEFAULTS })
    save({ ...DEFAULTS })
  }
}))

/** 是否应该禁用动效：用户显式选择「精简动效」，或系统设置了 prefers-reduced-motion。 */
export function shouldReduceMotion(): boolean {
  if (useSettings.getState().reducedMotion) return true
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}
