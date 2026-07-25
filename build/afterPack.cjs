// electron-builder afterPack 钩子：
//   1) 剔除多余语言包，只保留中文与英文；
//   2) 给 Windows exe 写入图标与版本信息。
//
// 关于 (2)：electron-builder 默认用 rcedit 写 exe 图标，而 rcedit 是 Windows 程序，
// 在 Linux 上需要 Wine。本构建机没有 Wine 也没有 sudo，故 package.json 里设了
// `win.signAndEditExecutable:false` 跳过该步骤——但那样打出来的 exe 会顶着 Electron
// 默认图标。这里改用 resedit（纯 JS 的 PE 资源编辑器）直接改写 PE 资源段，
// 无需 Wine 即可把图标和版本信息写进去。
const fs = require('fs')
const path = require('path')

const KEEP = new Set(['en-US.pak', 'zh-CN.pak'])

function trimLocales(context) {
  const dir = path.join(context.appOutDir, 'locales')
  if (!fs.existsSync(dir)) return
  let removed = 0
  let freed = 0
  const kept = []
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.pak')) continue
    if (KEEP.has(f)) {
      kept.push(f)
      continue
    }
    const p = path.join(dir, f)
    freed += fs.statSync(p).size
    fs.rmSync(p)
    removed++
  }
  console.log(
    `  • afterPack: 语言包保留 [${kept.join(', ')}]，删除 ${removed} 个，释放 ${(freed / 1e6).toFixed(1)} MB`
  )
}

async function brandExe(context) {
  if (context.electronPlatformName !== 'win32') return

  const { productName, version } = context.packager.appInfo
  const exePath = path.join(context.appOutDir, `${productName}.exe`)
  const icoPath = path.join(__dirname, 'icon.ico')
  if (!fs.existsSync(exePath) || !fs.existsSync(icoPath)) {
    console.log('  • afterPack: 未找到 exe 或 icon.ico，跳过图标写入')
    return
  }

  // resedit v3 是 ESM，CJS 侧要走它提供的 ./cjs 入口
  const ResEdit = await require('resedit/cjs').load()

  const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath))
  const res = ResEdit.NtExecutableResource.from(exe)

  // ---- 图标 ----
  const ico = ResEdit.Data.IconFile.from(fs.readFileSync(icoPath))
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
    res.entries,
    1, // 主图标组 ID，Windows 资源管理器取的就是它
    1033,
    ico.icons.map((i) => i.data)
  )

  // ---- 版本信息（属性面板里显示的名称/公司/版本）----
  const viList = ResEdit.Resource.VersionInfo.fromEntries(res.entries)
  const vi = viList.length ? viList[0] : ResEdit.Resource.VersionInfo.createEmpty()
  vi.setFileVersion(...version.split('.').map(Number).concat([0, 0, 0, 0]).slice(0, 4))
  vi.setProductVersion(...version.split('.').map(Number).concat([0, 0, 0, 0]).slice(0, 4))
  vi.setStringValues(
    { lang: 1033, codepage: 1200 },
    {
      ProductName: productName,
      FileDescription: '中影智能 无人机地面控制站',
      CompanyName: '中影智能',
      LegalCopyright: '中影智能',
      OriginalFilename: `${productName}.exe`,
      InternalName: productName
    }
  )
  vi.outputToResourceEntries(res.entries)

  res.outputResource(exe)
  fs.writeFileSync(exePath, Buffer.from(exe.generate()))
  console.log(`  • afterPack: 已写入 exe 图标（${ico.icons.length} 个尺寸）与版本信息 → ${productName}.exe`)
}

module.exports = async function afterPack(context) {
  trimLocales(context)
  await brandExe(context)
}
