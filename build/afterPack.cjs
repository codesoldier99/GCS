// electron-builder afterPack 钩子：剔除多余语言包，只保留中文与英文。
const fs = require('fs')
const path = require('path')

const KEEP = new Set(['en-US.pak', 'zh-CN.pak'])

module.exports = async function afterPack(context) {
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
