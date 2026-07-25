import { app, BrowserWindow, shell } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { registerIpc } from './ipc'
import { LinkManager } from './link/LinkManager'

const isDev = !!process.env['ELECTRON_RENDERER_URL']

/**
 * 离屏渲染模式（`GCS_OFFSCREEN=1`）。
 * 用于在**没有显示器的构建机**上跑界面验证与生成使用手册截图：
 * 窗口渲染到内存位图，由 `webContents.capturePage()` 取帧。
 * 正常启动不受影响。参见 `docs/make-shots.cjs`。
 */
const isOffscreen = process.env['GCS_OFFSCREEN'] === '1'

// 打包产物不含 build/（electron-builder 的 win.icon 已把图标直接嵌入 exe），
// 这个路径只在本地开发（未打包）时用于设置窗口/任务栏图标。
const devIconPath = join(__dirname, '../../build/icon.png')

let mainWindow: BrowserWindow | null = null
const link = new LinkManager()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    frame: false, // 无边框：自绘标志式标题栏
    backgroundColor: '#080B12',
    titleBarStyle: 'hidden',
    ...(existsSync(devIconPath) ? { icon: devIconPath } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      ...(isOffscreen ? { offscreen: true } : {})
    }
  })

  // 离屏窗口不需要（也不应该）显示；无显示器的机器上 show() 反而可能出问题
  if (!isOffscreen) mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] as string)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpc(() => mainWindow, link)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  link.disconnect()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => link.disconnect())
