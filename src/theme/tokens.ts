// 供 Canvas/SVG 仪表等以 JS 读取的令牌（与 peugeot.css 保持一致）。
// Canvas 无法读 CSS 变量，故这里镜像关键色值；改色时两处同步。

export const C = {
  bg0: '#080b12',
  bg1: '#0e1524',
  bg2: '#16213a',
  bg3: '#1d2c4a',
  stroke: '#26374f',
  strokeHi: 'rgba(180,210,245,0.28)',
  primary: '#17d4e6',
  primaryDeep: '#0a84c4',
  primaryGlow: 'rgba(23,212,230,0.55)',
  accent: '#f2a100',
  danger: '#e63328',
  success: '#22e08a',
  catSim: '#7b8cff',
  textHi: '#eaf2ff',
  textMid: '#9bb0d0',
  textLo: '#5c6e8c',
  // 姿态球
  sky: '#1f7fb8',
  skyHi: '#37a6d6',
  ground: '#6b4a1e',
  groundHi: '#8a642c'
} as const

export const FONT_NUM =
  "'Rajdhani','Oxanium','DIN Alternate','Consolas',system-ui,sans-serif"
