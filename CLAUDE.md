# CLAUDE.md — 中影智能 无人机地面控制站

> 面向无人机培训学校**学员**的桌面地面站（GCS），连接 **APM / ArduPilot** 飞控（参考硬件：翎客 X6PRO，STM32H743）。
> 设计参考两份资料：`GCS.pdf`（翎客 LinkGCS2 / 华科尔 WKDES 功能界面）与 `FLIGHT CONTROL.pdf`（X6PRO 飞控手册）。
> **第一优先级：界面配色参考标志(Peugeot) i-Cockpit 汽车仪表方案 —— 优雅、大方、有艺术性。**

---

## 1. 项目定位

- **用户**：培训学校学员（大多无真机）。因此 **仿真优先 + 保留真机 MAVLink 接口**。
- **连接目标**：APM/ArduPilot（X6PRO）。协议 = MAVLink（serial 115200 / UDP / TCP），另含内置 SITL 式模拟器。
- **功能范围**：复刻 `GCS.pdf` 全部功能（主菜单、遥测栏、姿态球、航点规划/模板/旋转平移/上下载、CAAC 绕八字考试等）+ `FLIGHT CONTROL.pdf` 的装机向导/调参/安全项。

## 2. 技术栈与命令

- **Electron + React + TypeScript**，构建工具 **electron-vite**（Vite）。
- 地图：**MapLibre GL**（默认 Esri World Imagery 卫星，免 Key；可切 OSM；预留高德/天地图）。
- MAVLink：**node-mavlink**；串口：**serialport**。均只在**主进程**使用。
- 仪表（姿态球/罗盘/油门条/振动条）：**Canvas/SVG 自绘**。
- 状态：**zustand**。
- 打包：**electron-builder**，Windows `.exe` 优先，兼容 mac/Linux。

```bash
npm install          # 安装依赖
npm run dev          # electron-vite 热重载，起开发窗口
npm run typecheck    # tsc 类型检查（不产出）
npm run build        # 产出 out/（主/预加载/渲染）
npm run dist         # electron-builder 打包安装程序
```
> Node ≥ 20。本机 Node 装在 `~/.local/node/bin`（已加入 `~/.bashrc` PATH）。

## 3. 架构约定（务必遵守）

- **进程边界**：主进程 (`electron/`) 独占硬件/网络/MAVLink/文件；渲染进程 (`src/`) 纯 UI。
- **安全**：`nodeIntegration:false`、`contextIsolation:true`；渲染只能通过 `electron/preload.ts` 暴露的 `window.gcs` API 与主进程通信。
- **共享类型**：主/渲染共用的类型放 `shared/`（`telemetry.ts` / `mission.ts` / `protocol.ts`），两侧都 import，杜绝重复定义。
- **数据流**：`LinkManager`（收 MAVLink 或仿真）→ 归一化 `TelemetryFrame` → IPC `telemetry:frame` 推送 → 渲染 `vehicleStore` → 仪表/地图订阅。UI **不区分**数据来源（真机 vs 仿真）。
- **指令流**：渲染 `window.gcs.command(...)` → IPC `command:*` → 主进程发 MAVLink（或驱动仿真）。

### 目录
```
electron/            主进程
  main.ts            窗口/生命周期（无边框标题栏）
  preload.ts         contextBridge 暴露 window.gcs
  ipc.ts             IPC 通道注册
  link/
    LinkManager.ts   连接调度（sim/serial/udp/tcp）+ 遥测泵
    SerialLink.ts UdpLink.ts TcpLink.ts   传输层（返回原始字节流）
    MavlinkCodec.ts  node-mavlink 解析/封包 → TelemetryFrame / 指令
    Simulator.ts     SITL 式仿真：物理积分 + 生成 TelemetryFrame + 响应指令
shared/              主/渲染共享类型
  telemetry.ts mission.ts protocol.ts
src/                 渲染进程 (React)
  main.tsx App.tsx
  theme/  peugeot.css tokens.ts
  state/  vehicleStore.ts linkStore.ts missionStore.ts
  mavlink/ modeMap.ts
  components/
    instruments/  AttitudeBall Compass ThrottleBars Gauge VibrationMeter
    layout/       TitleBar TopStatusBar BottomInstrumentBar WaypointToolbar MapToolbar
    map/          FlightMap
    connection/   ConnectDialog
    pages/        HomeMenu FlightView MissionFlight SetupWizard CaacTraining Tuning
```

## 4. 设计系统铁律 —— 标志(Peugeot) i-Cockpit

**颜色/间距/圆角/辉光只能引用 `src/theme/peugeot.css` 的 CSS 变量，禁止在组件里硬编码色值。**

i-Cockpit 美学：深邃近黑蓝底 + 冰蓝荧光主色 + 铬银描边 + 标志红警示 + 暖琥珀次强调 + 蓝白辉光分层景深。核心变量：

| 变量 | 值 | 用途 |
|---|---|---|
| `--bg-0` | `#080B12` | 最底背景（径向渐变） |
| `--bg-1` | `#0E1524` | 面板基色 |
| `--bg-2` | `#16213A` | 抬升表面/卡片 |
| `--stroke` | `#26374F` | 铬银描边（配 1px 内高光） |
| `--primary` | `#17D4E6` | 冰蓝荧光（主读数/姿态地平线） |
| `--primary-deep` | `#0A84C4` | 标志蓝（强调/进度） |
| `--accent` | `#F2A100` | 琥珀（次强调/悬停） |
| `--danger` | `#E63328` | 标志红（红线/告警/解锁危险） |
| `--success` | `#22E08A` | GPS 定位/正常 |
| `--text-hi/mid/lo` | `#EAF2FF`/`#9BB0D0`/`#5C6E8C` | 文本层级 |

- 数字读数用等宽科技字体（Rajdhani/Oxanium 内嵌），中文用系统无衬线。
- 仪表需有荧光质感（`--primary` 低透明 glow）；卡片有 1px 铬银高光内描边。
- **艺术性优先**：宁可多花心思在动效、层次、留白，也不要平庸的默认样式。

## 5. MAVLink ↔ 遥测映射（ArduPilot）

| MAVLink 消息 | 提供字段 |
|---|---|
| HEARTBEAT | 飞行模式(`custom_mode`)、解锁(`base_mode` ARMED 位) |
| ATTITUDE | 横滚 roll / 俯仰 pitch / 航向 yaw |
| GLOBAL_POSITION_INT | 经纬度、相对高、海拔、vx/vy/vz、hdg |
| VFR_HUD | 地速、爬升率、油门% |
| SYS_STATUS / BATTERY_STATUS | 电压、电流、余量 |
| GPS_RAW_INT | 定位类型 fix、卫星数 |
| VIBRATION | 振动 X/Y/Z |
| RC_CHANNELS | 摇杆通道 |
| SERVO_OUTPUT_RAW | 电机 M1–M8 输出 |
| HOME_POSITION | 起飞点（算距起飞点） |

**指令**：`COMMAND_LONG` → `MAV_CMD_COMPONENT_ARM_DISARM`（解锁/上锁）、`DO_SET_MODE`（切模式）、`NAV_TAKEOFF`（起飞）、`NAV_RETURN_TO_LAUNCH`（返航）。**航点**走 `MISSION_COUNT/ITEM_INT/REQUEST`。

**ArduCopter 模式映射**（`src/mavlink/modeMap.ts`）：`0 姿态(Stabilize)`、`2 定高(AltHold)`、`3 自动(Auto)`、`4 指引(Guided)`、`5 GPS(Loiter)`、`6 返航(RTL)`、`9 降落(Land)`、`16 PosHold`。

## 6. 中文术语对照（与手册一致，UI 命名照此）

解锁/上锁、姿态模式、GPS模式、返航模式、降落模式、自动模式、指引模式(RTK)、航点、航线、转弯模式、悬停转弯/协调转弯/自适应协调转弯、悬停时间、航线闭合、爬升类型、返航高度、一/二级电压保护、电子围栏、失控保护、绕八字飞行考试、电子桩。

## 7. 安全约定

- 危险指令（解锁、切模式、起飞、上传航点、电机测试）在 UI 上**二次确认**。
- 电机测试/解锁页面显式提示"卸下螺旋桨"。
- 仿真与真机在 UI 上有清晰标识，避免混淆。

## 8. 里程碑状态

- [x] **M1 骨架**（已完成，构建/类型检查/离屏渲染均通过）：脚手架 · 标志主题 · 主菜单 · 顶部遥测栏 · 底部仪表栏（姿态球/罗盘/油门条/振动） · MapLibre 卫星地图+实时轨迹 · 内置仿真 + 真机 MAVLink（串口/UDP/TCP）· 解锁/起飞/返航/降落/切模式 + 一键演示。
- [x] **M2 航线规划**（已完成）：地图点击加点/拖拽/编号标记 · 航线折线+分段标签(距离|速度|航向) · 增删/清空/显示全部/撤销重做 · 左侧航线设置(批量修改+完成动作/循环/闭合/起始点/爬升) · 单航点编辑(经纬/高度/方位角/相对距离/转弯/悬停/速度) · 相对坐标编辑器 · 旋转/平移/反序 · 模板(圆形/弓形/星形，含预览) · 拖拽改顺序 · 航点上传/下载(MAVLink MISSION 协议) · 仿真 AUTO 自动飞航线。
  - 关键文件：`src/state/missionStore.ts`、`src/util/geo.ts`、`src/util/missionTemplates.ts`、`src/components/mission/*`、`electron/link/RealLink.ts`(uploadMission/downloadMission)、`electron/link/Simulator.ts`(AUTO 飞行)。
- [x] **M3 装机向导 + 调参**（已完成）：装机向导 6 步（机架类型→电机测试(卸桨确认+转向图)→飞控安装偏移→GPS安装偏移→安全项(返航/一二级电压/电子围栏/失控保护/指南针校准)→遥控器(飞行模式六段+实时通道条+行程))；飞控调参(全参数表 搜索/编辑/写入 + 固件升级页)。基于 **MAVLink PARAM 协议**(读列表/写参数)与 **指南针校准**(MAG_CAL/仿真进度)。
  - 关键文件：`electron/link/simParams.ts`、`electron/link/RealLink.ts`(refreshParams/setParam/mag-cal)、`electron/link/Simulator.ts`、`src/state/paramStore.ts`、`src/mavlink/params.ts`、`src/components/wizard/*`、`src/components/tuning/*`。
- [x] **M4 CAAC 训练 + 日志回放**（已完成）：绕八字飞行考试（两电子桩 + 理想八字路径绘制 + **实时评分**：完成圈数/最大横向偏差/平均偏差/高度保持/用时/合格判定）；电子桩布设（点击/自动，RTK 提示）；仿真绕八字自动飞行演示；飞行日志**录制 + 回放**（时间轴 播放/暂停/0.5–8×/拖动，驱动仪表与地图轨迹）+ JSON 导入导出。
  - 关键文件：`src/util/figure8.ts`、`src/state/caacStore.ts`、`src/state/logStore.ts`、`src/components/caac/*`、`electron/link/Simulator.ts`(figure8 相位)。

> 全部四个里程碑已完成。每次改动后更新本节并同步 `README`。

## 9. 学员测试修复轮（`docs/修改建议1.pdf` 26 项）

- **稳定性**：`electron/main.ts` 窗口关闭后置空 `mainWindow`；`electron/ipc.ts` 所有事件转发加 `isDestroyed()` 守卫（修复关闭软件报 `Object has been destroyed`）；新增 `src/components/ErrorBoundary.tsx` 包裹路由内容兜底；`MissionOverlay`/`CaacOverlay` 卸载清理包 `try/catch`（修复航线界面切回主菜单黑屏/卡死）。
- **航点交互根因修复**：`MissionOverlay.tsx` 里 marker 元素上原有的 `mousedown` `stopPropagation()` 会挡住 MapLibre 自身基于 `map.on('mousedown', ...)` 实现的拖拽机制，导致航点**完全无法拖动**——已删除该调用（现在依赖 MapLibre 自身的 `preventDefault()` 避免与地图平移冲突）；另将整店订阅触发的 `rebuild()` 对正在拖拽中的 marker 跳过 `setLngLat`，并在 `dragstart`/`dragend` 都调用一次 `select()`，兼容 MapLibre 拖拽后吞掉 `click` 的情况（单航点编辑面板不再打不开）。
- **新增**：航点右键菜单（编辑/插入/以此为基准生成相对坐标/删除，`WaypointContextMenu.tsx`）；手动起飞点（`missionStore.homeOverride` + `util/effectiveHome.ts`，未连接飞控时也可规划）；测距工具（`components/map/MeasureTool.tsx`）；相对坐标编辑器"夹角"模式；`FloatingPanel.tsx`（相对坐标/航线变换/航线模板改为可拖动浮动面板，不挡地图）；`ConfirmDialog.tsx`（替换 `window.confirm`）；航点列表+上传下载合并为带 Tab 的对话框。
- **转弯模式**扩到三种（`stop`/`coordinated`/`adaptive`，`util/missionEnums.ts`），借鉴 ArduPilot/QGC 用 `NAV_WAYPOINT` 大小到点半径 + `NAV_SPLINE_WAYPOINT` 样条航点区分（`RealLink.ts`），仿真同步体现飞行差异。
- **航线循环/完成动作**：`MissionUploadOptions` 补上 `loopCount`/`infiniteLoop`（此前静默丢弃），真机侧用 `DO_JUMP` 实现循环、`NAV_LOITER_UNLIM` 实现新增的"返回起飞点悬停"完成动作；仿真同步支持。
- **弓形扫描模板**方向符号修正（`util/missionTemplates.ts`，此前"左上/右上"起点会往错误方向扫）。
- **数值限位与坐标**：`util/limits.ts` + `NumberInput` 真正 clamp（原来 `min/max` 只是 HTML 属性、不阻止打字越界）；经纬度 DMS 切换（`util/dms.ts` + `LatLonField`）。
- **姿态球**底部加数字航向读数（`AttitudeBall.tsx`）。
- **视觉**：主菜单卡片色值改引用 `theme/tokens.ts`（新增 `catSim`/`--cat-sim`），消除硬编码色值；`.panel`/姿态球外圈补铬银倒角层次。
- **右侧工具栏溢出**（`WaypointToolbar`/`MapToolbar`）改为 `maxHeight: calc(100% - 28px)` + `overflow-y: auto`，小窗口下可滚动到达全部按钮。
- **模拟飞行界面**现在也挂载航线编辑 UI（`FlightView.tsx`，此前只有"航线飞行"模式能加点画航线）。

## 10. 动效与声音层（未来感 / 科技感改造）

> 运行环境是 Electron（固定 Chromium 130），故直接使用 View Transitions、CSS `@property`
> 等新特性，**不需要兼容分支或 polyfill**。

- **环形主菜单** `src/components/pages/RingMenu.tsx`：6 个 SVG 环形扇区极坐标排布
  （`annularSector()` 画环形扇区路径），悬停时扇区沿角平分线外扩 + 分类色辉光 +
  中心信息盘联动显示该功能详情；外圈有刻度环与缓慢旋转的扫描弧，呼应姿态球罗盘环。
  支持方向键导航 / Enter 选中 / Esc 取消。
  - **入场与悬停用两层 `<g>` 分离**：外层跑 WAAPI 交错入场，内层跑 CSS 悬停位移——
    否则两者争抢同一个 `transform`，WAAPI 的 `fill:'both'` 会锁死 CSS 过渡。
- **音效** `src/audio/engine.ts`：Web Audio 振荡器**程序化合成**，不加载任何音频文件
  （零体积、零延迟，且可参数化——告警音能随危险等级实时变化）。
  - **双总线**：UI 总线可被用户静音；**告警总线独立**，不受 UI 静音影响，
    因为电压/失控告警属安全信息，不应被界面静音顺带屏蔽。
  - 指数斜坡不能以 0 为端点，包络用 `0.0001` 收尾（写成 0 会抛异常或静音）。
  - 自动播放策略：`App.tsx` 在首次 `pointerdown`/`keydown` 时 `unlockAudio()` 一次。
- **路由过渡**：`uiStore.go` 用 `document.startViewTransition` 包裹，内部必须
  `flushSync` 同步提交 React 更新，否则截不到新旧两帧。
- **设置** `src/state/settingsStore.ts`（localStorage 持久化）+ `SettingsDialog.tsx`：
  界面音效开关 / 界面音量 / 告警音量 / 精简动效，标题栏齿轮进入。
- **动效护栏**（务必保持）：
  1. **飞行界面必须克制**——环形菜单、流光描边等只用于主菜单/设置等"外壳"页面，
     飞行主界面不加装饰动效，避免分散学员注意力（安全考量）。
  2. **低配笔记本**——动效只用 `transform`/`opacity`（GPU 合成，不触发 layout/paint）；
     「精简动效」开关写 `data-motion="reduced"` 到根元素，CSS 统一降级；
     同时尊重系统 `prefers-reduced-motion`（见 `util/motion.ts`、`peugeot.css` 末尾）。
  3. **教室场景**——界面音效必须能一键全局静音。
  4. **CSP**——`index.html` 是 `default-src 'self'`，字体/图片/音频一律本地打包，不引 CDN。
