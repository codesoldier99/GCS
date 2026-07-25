import type { CSSProperties } from 'react'

export type IconName =
  | 'drone'
  | 'propeller'
  | 'battery'
  | 'satellite'
  | 'speed-h'
  | 'speed-v'
  | 'altitude'
  | 'mountain'
  | 'flag'
  | 'clock'
  | 'home'
  | 'layers'
  | 'ruler'
  | 'target'
  | 'locate'
  | 'eraser'
  | 'compass'
  | 'plus'
  | 'minus'
  | 'trash'
  | 'route'
  | 'manual'
  | 'wizard'
  | 'caac'
  | 'tuning'
  | 'sim'
  | 'link'
  | 'unlink'
  | 'play'
  | 'stop'
  | 'min'
  | 'max'
  | 'close'
  | 'chevron-left'
  | 'crosshair'
  | 'takeoff'
  | 'rtl'
  | 'follow'
  | 'undo'
  | 'redo'
  | 'upload'
  | 'download'
  | 'list'
  | 'circle'
  | 'star'
  | 'wave'
  | 'reverse'
  | 'grip'
  | 'save'

/** 图标路径数据（24×24 viewBox）。导出以便在别处的 SVG 里内联复用，如环形主菜单。 */
export const ICON_PATHS: Record<IconName, string> = {
  drone:
    'M4 4l4 4M20 4l-4 4M4 20l4-4M20 20l-4-4M9 9h6v6H9zM6 6a2 2 0 100-.01M18 6a2 2 0 100-.01M6 18a2 2 0 100-.01M18 18a2 2 0 100-.01',
  propeller:
    'M12 12c0-3-1-6-4-6s-3 4-1 6M12 12c3 0 6-1 6-4s-4-3-6-1M12 12c0 3 1 6 4 6s3-4 1-6M12 12c-3 0-6 1-6 4s4 3 6 1',
  battery: 'M3 8h15v8H3zM18 10h2v4h-2zM6 10v4M9 10v4M12 10v4',
  satellite: 'M5 15l-2 4M9 3l3 3M4 10l6 6M7 7l3 3M13 11l4-4a2 2 0 013 3l-4 4M13 17a4 4 0 004-4',
  'speed-h': 'M12 21a9 9 0 110-18 9 9 0 010 18zM12 12l4-3M12 12v-4',
  'speed-v': 'M12 21a9 9 0 110-18 9 9 0 010 18zM12 12l-3-2M12 12l3 4',
  altitude: 'M8 3v18M16 3v18M4 3h8M4 21h8M16 3h4M16 21h4M8 8l-2 2M8 8l2 2M16 16l-2-2M16 16l2-2',
  mountain: 'M3 20h18L14 7l-3 5-2-3z',
  flag: 'M6 21V4M6 4h11l-2 4 2 4H6',
  clock: 'M12 21a9 9 0 110-18 9 9 0 010 18zM12 7v5l3 2',
  home: 'M3 11l9-8 9 8M6 10v10h12V10',
  layers: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5',
  ruler: 'M3 15l12-12 6 6L9 21zM7 11l2 2M11 7l2 2M15 11l1 1',
  target: 'M12 21a9 9 0 110-18 9 9 0 010 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 3v3M12 18v3M3 12h3M18 12h3',
  locate: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v3M12 19v3M2 12h3M19 12h3',
  eraser: 'M7 21h10M5 15l6-6 7 7-4 4H9zM10 10l7 7',
  compass: 'M12 21a9 9 0 110-18 9 9 0 010 18zM15 9l-2 5-5 2 2-5z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  route: 'M6 19a3 3 0 100-6 3 3 0 000 6zM18 11a3 3 0 100-6 3 3 0 000 6zM9 16h6a3 3 0 003-3',
  manual: 'M5 9h14v10H5zM8 6v3M16 6v3M9 13h2M13 13h2M9 16h6',
  wizard: 'M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM19 15l1 2 2 1-2 1-1 2-1-2-2-1 2-1z',
  caac: 'M12 3l7 4v5c0 4-3 7-7 9-4-2-7-5-7-9V7zM9 12l2 2 4-4',
  tuning: 'M4 6h16M4 12h16M4 18h16M8 4v4M16 10v4M11 16v4',
  sim: 'M4 5h16v11H4zM9 20h6M8 9l3 2-3 2zM13 11h4',
  link: 'M9 15l6-6M8 12l-2 2a3 3 0 004 4l2-2M16 12l2-2a3 3 0 00-4-4l-2 2',
  unlink: 'M8 12l-2 2a3 3 0 004 4l2-2M16 12l2-2a3 3 0 00-4-4l-2 2M4 4l16 16',
  play: 'M7 5l12 7-12 7z',
  stop: 'M6 6h12v12H6z',
  min: 'M5 12h14',
  max: 'M5 5h14v14H5z',
  close: 'M6 6l12 12M18 6L6 18',
  'chevron-left': 'M15 5l-7 7 7 7',
  crosshair: 'M12 3v6M12 15v6M3 12h6M15 12h6M12 12h.01',
  takeoff: 'M3 20h18M5 16l14-4-3-5 2 1 4 3-15 5zM8 13l-2-3',
  rtl: 'M9 7L4 12l5 5M4 12h11a5 5 0 015 5v1',
  follow: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v3M12 19v3M2 12h3M19 12h3',
  undo: 'M9 7L4 12l5 5M4 12h11a4 4 0 010 8h-1',
  redo: 'M15 7l5 5-5 5M20 12H9a4 4 0 000 8h1',
  upload: 'M12 20V8M7 11l5-5 5 5M5 4h14',
  download: 'M12 4v12M7 13l5 5 5-5M5 20h14',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  circle: 'M12 21a9 9 0 110-18 9 9 0 010 18z',
  star: 'M12 3l2.6 5.7 6.4.7-4.7 4.3 1.3 6.3L12 17l-5.9 3.3 1.3-6.3L2.7 9.4l6.4-.7z',
  wave: 'M4 7h16M20 7v4H4M4 11v4h16M20 15v4H4',
  reverse: 'M7 4L3 8l4 4M3 8h13a4 4 0 010 8M17 20l4-4-4-4',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  save: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6'
}

interface Props {
  name: IconName
  size?: number
  color?: string
  strokeWidth?: number
  style?: CSSProperties
}

export function Icon({ name, size = 20, color = 'currentColor', strokeWidth = 1.8, style }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  )
}
