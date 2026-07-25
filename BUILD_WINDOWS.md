# Windows 打包说明

## 产物

- **便携版（免安装）**：`release/中影智能-0.1.0-win.zip`（约 111 MB，解压后约省 41 MB）
  完整的 Windows 应用。解压后双击 `中影智能.exe` 即可运行，无需安装。
  已包含 Chromium 运行时与 **serialport 原生模块（win32-x64）**，真机串口连接可用。
  已通过 `build/afterPack.cjs` 钩子剔除多余语言包，仅保留 `zh-CN` 与 `en-US`（删除 53 个 `.pak`）。

## 生成命令

```bash
# 需先设置镜像（GitHub 被墙时）：
export ELECTRON_MIRROR="https://registry.npmmirror.com/-/binary/electron/"
export ELECTRON_BUILDER_BINARIES_MIRROR="https://registry.npmmirror.com/-/binary/electron-builder-binaries/"

npm run build                         # 编译主/预加载/渲染
npx electron-builder --win zip --x64  # 生成便携 zip（无需 Wine）
```

## 关于 NSIS `.exe` 安装包

生成 `.exe` 安装向导（NSIS 目标）**在 Linux 上需要 Wine**（electron-builder 用它编译安装器并写入可执行文件元数据）。
本构建机无 Wine 且无 sudo 权限，故只产出便携 zip。

在 **Windows 机器**或**装有 Wine 的 Linux** 上，执行以下命令即可得到 `中影智能-0.1.0-Setup.exe`：

```bash
npm install
npm run dist        # = electron-vite build && electron-builder --win
```

配置见 `package.json` 的 `build` 字段：`win.target = ["nsis","zip"]`，
`nsis` 为非一键安装、可选安装目录、创建桌面快捷方式。

## 关于 exe 图标（无 Wine 方案）

electron-builder 默认用 **rcedit** 把图标写进 exe，而 rcedit 是 Windows 程序，
Linux 上需要 Wine。本机无 Wine 且无 sudo，故 `win.signAndEditExecutable:false` 跳过该步——
但那样打出来的 exe 会顶着 **Electron 默认图标**。

解决办法见 `build/afterPack.cjs`：改用 **resedit**（纯 JS 的 PE 资源编辑器）直接改写
PE 资源段，无需 Wine 即可写入 7 个尺寸的图标（16–256）与版本信息（产品名/公司/描述）。

> 注意：electron-builder 会在 afterPack **之前**把 asar 完整性校验哈希写进 exe 资源。
> resedit 重写资源时会完整保留其它资源条目，故校验仍然通过——改动该钩子后请务必复验：
> 对比 exe 内 `ElectronAsar` 资源声明的哈希与 `app.asar` 头部 JSON 的 SHA256
> （头部 JSON 从字节偏移 16 开始，长度取偏移 12–16 的 UInt32），两者必须一致，
> 否则应用在 Windows 上会启动失败。
