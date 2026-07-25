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
程序图标已配置为 `build/icon.ico`（`win.icon`，从 `docs/images/logo.jpg` 生成）；
若要在 Linux 上也生成 NSIS 安装器写入的图标元数据，需要 Wine（当前 `win.signAndEditExecutable:false` 是为了在没有 Wine 时跳过该步骤，去掉后 Linux 打包需 Wine）。
