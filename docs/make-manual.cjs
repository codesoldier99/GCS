const { app, BrowserWindow } = require('electron')
const path = require('path'); const fs = require('fs')
app.commandLine.appendSwitch('no-sandbox')
app.disableHardwareAcceleration()
const ROOT = '/home/zjs/projects/GCS'
const OUT = path.join(ROOT, 'docs', '中影智能-使用手册.pdf')
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1200, height: 1600, show: false,
    webPreferences: { offscreen: true, sandbox: false } })
  await win.loadFile(path.join(ROOT, 'docs', 'manual.html'))
  await new Promise(r => setTimeout(r, 2500)) // 等图片加载
  const footer = '<div style="font-size:8px;color:#7a8797;width:100%;padding:0 12mm;text-align:center;">'
    + '中影智能 无人机地面站 · 使用手册 &nbsp;·&nbsp; '
    + '<span class="pageNumber"></span> / <span class="totalPages"></span></div>'
  const pdf = await win.webContents.printToPDF({
    pageSize: 'A4',
    printBackground: true,
    margins: { top: 0.5, bottom: 0.62, left: 0.5, right: 0.5 },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: footer
  })
  fs.writeFileSync(OUT, pdf)
  console.log('PDF written:', OUT, (pdf.length/1024/1024).toFixed(2), 'MB')
  app.quit()
})
