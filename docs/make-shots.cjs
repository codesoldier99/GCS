/**
 * 使用手册配图生成器 —— 重新截取 docs/images/*.png。
 *
 * 用法（构建机无显示器，故走离屏渲染）：
 *   npm run build
 *   ELECTRON_DISABLE_SANDBOX=1 npx electron docs/make-shots.cjs --no-sandbox
 *
 * 做法：本脚本自己就是 Electron 主进程入口，先以 `GCS_OFFSCREEN=1` 动态 import
 * 应用真正的主进程包（out/main/main.js），于是拿到**完整的 IPC 与内置仿真**；
 * 随后取到同一进程里的窗口，用 sendInputEvent / executeJavaScript 驱动界面，
 * 再用 webContents.capturePage() 逐张截图。
 *
 * 这样截出来的图是真实运行状态（仿真在飞、参数已读取、评分在跑），
 * 而不是空数据的静态界面。
 */
process.env.GCS_OFFSCREEN = '1'

const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const OUT = path.join(ROOT, 'docs', 'images')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let win = null

async function shot(name) {
  // 离屏渲染是按帧产出的，截图前多等一拍，避免拿到过渡中的半帧
  await sleep(320)
  const img = await win.webContents.capturePage()
  const file = path.join(OUT, name)
  fs.writeFileSync(file, img.toPNG())
  const kb = (fs.statSync(file).size / 1024).toFixed(0)
  console.log(`  ✓ ${name.padEnd(26)} ${kb} KB`)
}

const js = (expr) => win.webContents.executeJavaScript(expr)

/** 按可见文本点击一个元素（返回是否命中） */
async function clickText(text, opts = {}) {
  const sel = opts.selector || 'button'
  const nth = opts.nth === undefined ? 0 : opts.nth
  const hit = await js(`
    (function(){
      const els = Array.from(document.querySelectorAll(${JSON.stringify(sel)}))
        .filter(e => e.textContent.includes(${JSON.stringify(text)}));
      const el = els[${nth}];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
    })()
  `)
  if (!hit) {
    const avail = await js(`
      Array.from(document.querySelectorAll(${JSON.stringify(sel)}))
        .map(e => e.textContent.trim().replace(/\\s+/g,' ')).filter(Boolean).slice(0, 14)
    `)
    console.log(`    ! 未找到可点击元素: "${text}"　当前可见: ${JSON.stringify(avail)}`)
    return false
  }
  await clickAt(hit.x, hit.y)
  return true
}

/** 按 title 属性子串定位工具栏图标按钮 */
async function iconBtn(titleSubstr) {
  const hit = await js(`
    (function(){
      const b = Array.from(document.querySelectorAll('.icon-btn'))
        .find(b => (b.getAttribute('title')||'').includes(${JSON.stringify(titleSubstr)}));
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
    })()
  `)
  if (!hit) console.log(`    ! 未找到图标按钮: "${titleSubstr}"`)
  return hit
}

async function clickAt(x, y) {
  win.webContents.sendInputEvent({ type: 'mouseMove', x, y })
  await sleep(40)
  win.webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 })
  await sleep(50)
  win.webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 })
  await sleep(260)
}

async function moveTo(x, y) {
  win.webContents.sendInputEvent({ type: 'mouseMove', x, y })
  await sleep(200)
}

/** 挪开鼠标，避免悬停高亮出现在截图里 */
async function parkMouse() {
  await moveTo(8, 780)
  await sleep(150)
}

/** 回主菜单 */
async function goHome() {
  await clickText('主菜单')
  await sleep(600)
}

/** 从环形主菜单进入某功能 */
async function enter(label) {
  const hit = await js(`
    (function(){
      const el = Array.from(document.querySelectorAll('[role="menuitem"]'))
        .find(e => (e.getAttribute('aria-label')||'') === ${JSON.stringify(label)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
    })()
  `)
  if (!hit) throw new Error(`环形菜单里找不到「${label}」`)
  await clickAt(hit.x, hit.y)
  await sleep(900)
}

/** 地图容器矩形（用于按比例点选落点） */
const mapRect = () =>
  js(`(function(){ const el=document.querySelector('.maplibregl-canvas'); if(!el) return null;
       const r=el.getBoundingClientRect(); return {left:r.left, top:r.top, width:r.width, height:r.height}; })()`)

async function connectSim() {
  await js(`window.gcs.connect({ kind: 'sim' })`)
  await sleep(1200)
}

/* ------------------------------------------------------------------ */

async function main() {
  await import(path.join(ROOT, 'out', 'main', 'main.js'))
  await app.whenReady()
  await sleep(1200)

  win = BrowserWindow.getAllWindows()[0]
  if (!win) throw new Error('应用窗口未创建')
  win.setContentSize(1440, 900)
  // 离屏窗口默认帧率较低，调高一点让动画/仪表画面更完整
  if (win.webContents.setFrameRate) win.webContents.setFrameRate(60)
  await sleep(2500) // 等首屏 + 环形菜单入场动画结束

  fs.mkdirSync(OUT, { recursive: true })
  console.log('开始生成使用手册配图：')

  /* ---- 1. 主菜单（环形） ---- */
  await parkMouse()
  await shot('home.png')

  /* ---- 2. 手动飞行：连仿真 + 一键演示，让仪表有真实数据 ---- */
  await enter('手动飞行')
  await connectSim()
  await clickText('一键演示')
  await sleep(9000) // 等它起飞并进入绕圈，地图上留出轨迹
  await parkMouse()
  await shot('flight.png')

  /* ---- 3. 航线飞行：画一条 4 点航线 ---- */
  await goHome()
  await enter('航线飞行')
  await sleep(4000) // 等卫星瓦片加载 + 地图 load 事件（MissionOverlay 的点击监听才挂上）
  {
    const m = await mapRect()
    if (!m) throw new Error('地图画布未就绪')
    const addBtn = await iconBtn('添加航点')
    if (addBtn) {
      await clickAt(addBtn.x, addBtn.y) // 进入加点模式
      const pts = [[0.42, 0.30], [0.62, 0.42], [0.55, 0.64], [0.35, 0.55]]
      for (const [fx, fy] of pts) {
        await clickAt(Math.round(m.left + m.width * fx), Math.round(m.top + m.height * fy))
        await sleep(180)
      }
      await clickAt(addBtn.x, addBtn.y) // 退出加点模式
      await js(`window.dispatchEvent(new Event('mission-fit'))`)
      await sleep(1000)
    }
    await parkMouse()
    await shot('mission.png')

    /* ---- 4. 航线模板（弓形 + 预览） ---- */
    const tplBtn = await iconBtn('航线模板')
    if (tplBtn) {
      await clickAt(tplBtn.x, tplBtn.y)
      await sleep(600)
      await clickText('弓形')
      await sleep(600)
      await parkMouse()
      await shot('mission-template.png')
      await clickText('取消') // 关掉浮动面板
      await sleep(400)
    }
  }

  /* ---- 5–8. 装机向导各步 ---- */
  await goHome()
  await enter('装机向导')
  await sleep(700)
  await parkMouse()
  await shot('m3-wizard-frame.png')

  await clickText('下一步')
  await sleep(600)
  // 勾选"已卸桨"，让电机测试按钮可用（截图更有信息量）
  await js(`
    (function(){ const cb = document.querySelector('input[type=checkbox]');
      if (cb && !cb.checked) { cb.click(); } return !!cb; })()`)
  await sleep(500)
  await parkMouse()
  await shot('m3-wizard-motor.png')

  // 跳到「安全项」(index 4)：连点下一步
  for (let i = 0; i < 3; i++) {
    await clickText('下一步')
    await sleep(500)
  }
  await parkMouse()
  await shot('m3-wizard-safety.png')

  await clickText('下一步')
  await sleep(700)
  await parkMouse()
  await shot('m3-wizard-rc.png')

  /* ---- 9–10. 飞控调参 ---- */
  await goHome()
  await enter('飞控调参')
  await sleep(1200)
  if (!(await clickText('读取参数'))) await clickText('重新读取')
  await sleep(3000) // 等参数列表加载完
  await parkMouse()
  await shot('m3-tuning-params.png')

  await clickText('固件升级')
  await sleep(600)
  await parkMouse()
  await shot('m3-tuning-firmware.png')

  /* ---- 11. CAAC 绕八字考试 ----
     「仿真演示」一步到位：连仿真 → 自动布桩 → 驱动八字飞行 → 300ms 后开始评分，
     所以不必再点「自动布桩」「开始考试」（点完演示后按钮已变成「结束并评分」）。 */
  await goHome()
  await enter('CAAC 训练')
  await sleep(3000)
  await clickText('仿真演示')
  await sleep(14000) // 让它飞够一段，评分面板有数据、地图上有八字轨迹
  await parkMouse()
  await shot('m4-exam.png')

  /* ---- 12. 日志回放 ---- */
  await clickText('飞行日志回放')
  await sleep(900)
  await clickText('回放当前会话')
  await sleep(1800)
  await parkMouse()
  await shot('m4-replay.png')

  console.log('全部完成。')
  app.quit()
}

main().catch((e) => {
  console.error('生成失败:', e)
  app.exit(1)
})

app.on('window-all-closed', () => {})
