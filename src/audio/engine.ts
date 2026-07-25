import { useSettings } from '../state/settingsStore'

/**
 * 程序化 UI 音效引擎（Web Audio 振荡器合成，不加载任何音频文件）。
 *
 * 选择合成而非音频素材的原因：
 *  - 零资源体积、零加载延迟（离线打包的桌面应用尤其受益）；
 *  - 可参数化——告警音能随电量/危险等级实时变急促、变尖锐，音频文件做不到；
 *  - 音色统一，天然贴合"科技感"的电子音。
 *
 * 分轨设计：UI 总线可被用户静音；告警总线独立，不受 UI 静音影响，
 * 因为飞行告警属于安全信息（见 settingsStore.alertVolume 注释）。
 */

export type Cue =
  | 'hover'
  | 'select'
  | 'back'
  | 'toggle'
  | 'success'
  | 'error'
  | 'danger'
  | 'alert'

type Bus = 'ui' | 'alert'

interface Tone {
  type: OscillatorType
  /** 起始频率 Hz */
  freq: number
  /** 频率扫向的目标 Hz（省略则不扫频） */
  to?: number
  /** 时长（秒） */
  dur: number
  /** 峰值增益 0–1 */
  gain: number
  /** 相对该 cue 起点的延迟（秒） */
  delay?: number
}

interface CueSpec {
  bus: Bus
  tones: Tone[]
}

const CUES: Record<Cue, CueSpec> = {
  // 悬停：极短高频 tick，几乎是"触感"而非"声音"
  hover: { bus: 'ui', tones: [{ type: 'sine', freq: 2100, to: 2600, dur: 0.04, gain: 0.09 }] },
  // 选中：双音上行，给出"进入"的确认感
  select: {
    bus: 'ui',
    tones: [
      { type: 'sine', freq: 880, to: 1180, dur: 0.08, gain: 0.16 },
      { type: 'sine', freq: 1320, to: 1760, dur: 0.10, gain: 0.11, delay: 0.055 }
    ]
  },
  // 返回：双音下行，与 select 呈镜像
  back: {
    bus: 'ui',
    tones: [
      { type: 'sine', freq: 1320, to: 990, dur: 0.08, gain: 0.13 },
      { type: 'sine', freq: 880, to: 660, dur: 0.09, gain: 0.09, delay: 0.05 }
    ]
  },
  toggle: { bus: 'ui', tones: [{ type: 'triangle', freq: 1400, to: 1200, dur: 0.05, gain: 0.11 }] },
  success: {
    bus: 'ui',
    tones: [
      { type: 'sine', freq: 784, dur: 0.09, gain: 0.14 },
      { type: 'sine', freq: 1047, dur: 0.09, gain: 0.14, delay: 0.08 },
      { type: 'sine', freq: 1568, dur: 0.16, gain: 0.11, delay: 0.16 }
    ]
  },
  error: { bus: 'ui', tones: [{ type: 'square', freq: 220, to: 150, dur: 0.20, gain: 0.10 }] },
  // 危险操作（解锁/起飞）：低频双击 + 轻微失谐，潜意识里的"注意"信号
  danger: {
    bus: 'ui',
    tones: [
      { type: 'sawtooth', freq: 180, dur: 0.09, gain: 0.13 },
      { type: 'sawtooth', freq: 172, dur: 0.11, gain: 0.13, delay: 0.12 }
    ]
  },
  // 飞行告警：走独立总线，UI 静音时依然发声
  alert: {
    bus: 'alert',
    tones: [
      { type: 'sawtooth', freq: 880, to: 990, dur: 0.11, gain: 0.20 },
      { type: 'sawtooth', freq: 880, to: 990, dur: 0.11, gain: 0.20, delay: 0.16 }
    ]
  }
}

class AudioEngine {
  private ctx: AudioContext | null = null
  private uiBus: GainNode | null = null
  private alertBus: GainNode | null = null
  private lastHoverAt = 0

  /** 懒创建 AudioContext：浏览器/Electron 的自动播放策略要求首次发声前有用户手势。 */
  private ensure(): boolean {
    if (this.ctx) {
      // 标签页/窗口恢复后上下文可能被挂起
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return true
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return false
    try {
      this.ctx = new Ctor()
      this.uiBus = this.ctx.createGain()
      this.alertBus = this.ctx.createGain()
      this.uiBus.connect(this.ctx.destination)
      this.alertBus.connect(this.ctx.destination)
      this.syncVolumes()
      return true
    } catch {
      this.ctx = null
      return false
    }
  }

  /** 在首次用户手势时调用，解除自动播放限制。 */
  unlock(): void {
    this.ensure()
  }

  private syncVolumes(): void {
    const s = useSettings.getState()
    if (this.uiBus) this.uiBus.gain.value = s.soundOn ? s.uiVolume : 0
    // 告警总线只受自身音量控制，不看 soundOn
    if (this.alertBus) this.alertBus.gain.value = s.alertVolume
  }

  play(cue: Cue): void {
    const spec = CUES[cue]
    const s = useSettings.getState()
    // UI 音效被关掉时，连 AudioContext 都不必创建
    if (spec.bus === 'ui' && (!s.soundOn || s.uiVolume <= 0)) return
    if (spec.bus === 'alert' && s.alertVolume <= 0) return

    // hover 会被鼠标高频触发，做个节流免得糊成一片
    if (cue === 'hover') {
      const now = performance.now()
      if (now - this.lastHoverAt < 55) return
      this.lastHoverAt = now
    }

    if (!this.ensure() || !this.ctx) return
    this.syncVolumes()
    const dest = spec.bus === 'alert' ? this.alertBus : this.uiBus
    if (!dest) return

    const t0 = this.ctx.currentTime
    for (const tone of spec.tones) {
      this.schedule(tone, t0 + (tone.delay ?? 0), dest)
    }
  }

  private schedule(tone: Tone, at: number, dest: GainNode): void {
    const ctx = this.ctx
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = tone.type
    osc.frequency.setValueAtTime(tone.freq, at)
    if (tone.to && tone.to !== tone.freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, tone.to), at + tone.dur)
    }

    // 指数衰减不能以 0 为起点或终点，故用极小正值收尾，听感上即静音
    const attack = Math.min(0.012, tone.dur * 0.25)
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(tone.gain, at + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + tone.dur)

    osc.connect(gain)
    gain.connect(dest)
    osc.start(at)
    osc.stop(at + tone.dur + 0.02)
    osc.onended = () => {
      osc.disconnect()
      gain.disconnect()
    }
  }
}

const engine = new AudioEngine()

/** 播放一个界面音效。UI 类音效受设置开关控制，告警类始终发声。 */
export function playCue(cue: Cue): void {
  engine.play(cue)
}

/** 首次用户手势时解锁音频上下文（自动播放策略）。 */
export function unlockAudio(): void {
  engine.unlock()
}
