import { useEffect, useRef } from 'react'
import { useVehicle } from '../../state/vehicleStore'
import { C, FONT_NUM } from '../../theme/tokens'

/** 姿态球：人工地平仪 + 俯仰梯 + 坡度弧 + 旋转罗盘环。Canvas 绘制。 */
export function AttitudeBall({ size = 190 }: { size?: number }): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    const ctx = canvas.getContext('2d')!
    let raf = 0

    const draw = () => {
      const f = useVehicle.getState().frame
      render(ctx, size, dpr, f.roll, f.pitch, f.yaw)
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [size])

  return (
    <canvas
      ref={ref}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        // 铬银倒角外圈：亮边 + 暗边模拟金属厚度，贴合标致仪表盘质感
        boxShadow:
          '0 0 0 1px var(--stroke-hi), 0 0 0 3px var(--bg-0), 0 0 0 4px var(--stroke-soft), ' +
          'inset 0 0 22px rgba(0,0,0,0.6), 0 0 26px rgba(23,212,230,0.14)'
      }}
    />
  )
}

function render(
  ctx: CanvasRenderingContext2D,
  size: number,
  dpr: number,
  roll: number,
  pitch: number,
  yaw: number
): void {
  ctx.save()
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, size, size)

  const cx = size / 2
  const cy = size / 2
  const R = size / 2
  const ringW = size * 0.11 // 罗盘环宽
  const ballR = R - ringW

  // ---------- 姿态球（在 ballR 圆内）----------
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, ballR, 0, Math.PI * 2)
  ctx.clip()

  ctx.translate(cx, cy)
  ctx.rotate(-roll)
  const pxPerDeg = ballR / 32
  const horizon = (pitch * 180) / Math.PI * pxPerDeg

  // 天空
  const sky = ctx.createLinearGradient(0, -ballR * 2, 0, horizon)
  sky.addColorStop(0, C.skyHi)
  sky.addColorStop(1, C.sky)
  ctx.fillStyle = sky
  ctx.fillRect(-ballR * 2, -ballR * 2, ballR * 4, ballR * 2 + horizon)
  // 地面
  const gnd = ctx.createLinearGradient(0, horizon, 0, ballR * 2)
  gnd.addColorStop(0, C.groundHi)
  gnd.addColorStop(1, C.ground)
  ctx.fillStyle = gnd
  ctx.fillRect(-ballR * 2, horizon, ballR * 4, ballR * 2)

  // 地平线
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(-ballR * 2, horizon)
  ctx.lineTo(ballR * 2, horizon)
  ctx.stroke()

  // 俯仰梯
  ctx.font = `600 9px ${FONT_NUM}`
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 1.2
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'
  for (let d = -30; d <= 30; d += 10) {
    if (d === 0) continue
    const y = horizon - d * pxPerDeg
    const w = d % 20 === 0 ? ballR * 0.34 : ballR * 0.18
    ctx.beginPath()
    ctx.moveTo(-w, y)
    ctx.lineTo(w, y)
    ctx.stroke()
    if (d % 20 === 0) {
      ctx.fillText(String(Math.abs(d)), -w - 10, y)
      ctx.fillText(String(Math.abs(d)), w + 10, y)
    }
  }
  ctx.restore()

  // ---------- 坡度弧 + 指针 ----------
  ctx.save()
  ctx.translate(cx, cy)
  ctx.strokeStyle = 'rgba(234,242,255,0.6)'
  ctx.fillStyle = 'rgba(234,242,255,0.85)'
  ctx.lineWidth = 1.2
  for (const a of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
    const rad = (a - 90) * (Math.PI / 180)
    const r1 = ballR
    const r2 = ballR - (a % 30 === 0 ? 9 : 5)
    ctx.beginPath()
    ctx.moveTo(Math.cos(rad) * r1, Math.sin(rad) * r1)
    ctx.lineTo(Math.cos(rad) * r2, Math.sin(rad) * r2)
    ctx.stroke()
  }
  // 当前坡度指针（顶部三角，随 roll 转）
  ctx.rotate(-roll)
  ctx.fillStyle = C.primary
  ctx.beginPath()
  ctx.moveTo(0, -ballR + 2)
  ctx.lineTo(-6, -ballR + 12)
  ctx.lineTo(6, -ballR + 12)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  // ---------- 固定飞机符号 ----------
  ctx.save()
  ctx.translate(cx, cy)
  ctx.strokeStyle = C.accent
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.moveTo(-ballR * 0.42, 0)
  ctx.lineTo(-ballR * 0.16, 0)
  ctx.moveTo(ballR * 0.16, 0)
  ctx.lineTo(ballR * 0.42, 0)
  ctx.moveTo(0, -3)
  ctx.lineTo(0, 3)
  ctx.stroke()
  ctx.fillStyle = C.accent
  ctx.beginPath()
  ctx.arc(0, 0, 2.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // ---------- 罗盘环 ----------
  ctx.save()
  ctx.translate(cx, cy)
  // 环底
  ctx.beginPath()
  ctx.arc(0, 0, R - ringW / 2, 0, Math.PI * 2)
  ctx.lineWidth = ringW
  ctx.strokeStyle = 'rgba(6,10,18,0.92)'
  ctx.stroke()

  ctx.rotate(-yaw)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let deg = 0; deg < 360; deg += 15) {
    const rad = (deg - 90) * (Math.PI / 180)
    const major = deg % 90 === 0
    const mid = deg % 45 === 0
    const rOut = R - 2
    const rIn = R - (major ? ringW * 0.7 : mid ? ringW * 0.55 : ringW * 0.38)
    ctx.strokeStyle = major ? C.primary : 'rgba(155,176,208,0.7)'
    ctx.lineWidth = major ? 2 : 1
    ctx.beginPath()
    ctx.moveTo(Math.cos(rad) * rOut, Math.sin(rad) * rOut)
    ctx.lineTo(Math.cos(rad) * rIn, Math.sin(rad) * rIn)
    ctx.stroke()
    if (major) {
      const letter = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[deg]!
      const rt = R - ringW * 0.5
      ctx.save()
      ctx.translate(Math.cos(rad) * rt, Math.sin(rad) * rt)
      ctx.rotate(yaw + rad + Math.PI / 2)
      ctx.fillStyle = deg === 0 ? C.danger : C.textHi
      ctx.font = `700 ${ringW * 0.62}px ${FONT_NUM}`
      ctx.fillText(letter, 0, 0)
      ctx.restore()
    }
  }
  ctx.restore()

  // 顶部固定航向索引
  ctx.save()
  ctx.translate(cx, cy)
  ctx.fillStyle = C.primary
  ctx.beginPath()
  ctx.moveTo(0, -R + 1)
  ctx.lineTo(-5, -R + ringW * 0.5)
  ctx.lineTo(5, -R + ringW * 0.5)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  // ---------- 底部数字航向读数（仿真实航电数字表头）----------
  ctx.save()
  ctx.translate(cx, cy)
  const hdg = Math.round((((yaw * 180) / Math.PI) % 360 + 360) % 360)
  const text = `${String(hdg).padStart(3, '0')}°`
  const boxW = size * 0.36
  const boxH = size * 0.14
  const boxY = ballR * 0.66
  const rad = 5
  ctx.beginPath()
  ctx.moveTo(-boxW / 2 + rad, boxY - boxH / 2)
  ctx.arcTo(boxW / 2, boxY - boxH / 2, boxW / 2, boxY + boxH / 2, rad)
  ctx.arcTo(boxW / 2, boxY + boxH / 2, -boxW / 2, boxY + boxH / 2, rad)
  ctx.arcTo(-boxW / 2, boxY + boxH / 2, -boxW / 2, boxY - boxH / 2, rad)
  ctx.arcTo(-boxW / 2, boxY - boxH / 2, boxW / 2, boxY - boxH / 2, rad)
  ctx.closePath()
  ctx.fillStyle = 'rgba(4,8,14,0.82)'
  ctx.fill()
  ctx.strokeStyle = C.primary
  ctx.lineWidth = 1.1
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${size * 0.082}px ${FONT_NUM}`
  ctx.shadowColor = C.primaryGlow
  ctx.shadowBlur = 6
  ctx.fillStyle = C.primary
  ctx.fillText(`HDG ${text}`, 0, boxY)
  ctx.shadowBlur = 0
  ctx.restore()

  ctx.restore()
}
