# 第三方实现来源

`common/vendor/` 只放外部引入的代码，保持原目录关系，便于整目录升级。自写代码不放这里。

## fy-code-animation

| 项 | 内容 |
|---|---|
| 来源 | `C:\Users\Administrator\.claude\skills\fy-code-animation` |
| 引入时间 | 2026-11-05 |
| 许可 | 作者免费分享；不得包装成付费课程 / 付费 skills / 收费资料出售。第三方内容沿用其原许可（见 `fy-LICENSES/`）。 |
| 已引入 | `implementations/` 全部，减去 `specimen/` |
| 未引入 | `specimen/`（3D：需要 `three`、`@react-three/fiber`、`@remotion/three`，当前未安装） |
| 已知状态 | 上游标注「已核读声明/源码，未编译、未运行、未媒体验收」。本工作区只做过类型检查；**首次使用某个组件必须实际渲染验证**。 |

引入的模块：

- `motion-core.mjs` / `motion-core.d.mts` — 运动数学（已有作品在用）
- `remotion-kit/` — 时间轴、SceneStack、音频、字幕、字体、随机
- `camera/` — 2D/2.5D 相机与镜头路径
- `transitions/` — 转场
- `backgrounds/` — 程序化背景
- `data-ui/` — 计数、图表、光标、设备框、图片快闪
- `type-cn/` — 中文动态文字
- `craft/` — 手绘、线描、像素、字体工艺
- `audio-sync/` — 节拍网格
- `canvas-contract.mjs` — Canvas 画幅与时间契约

## Canvas 引擎

| 项 | 内容 |
|---|---|
| 来源 | 本机 `D:\Files\Agent_session\claude_04\common\engine\engine.js` |
| 性质 | 自有代码（作者工作区） |
| 状态 | 已有一个交付作品使用过；在本工作区通过 `common/engine/canvas.ts` 注入 `CONFIG` 后由 `CanvasStage` 调用，已渲染验证 |
| 未引入 | 原工作区的 `scenes.js`（含作品文案与内容） |

## 公共素材

见 `common/assets/REGISTRY.json`。摘要：

| 类别 | 来源 | 许可 |
|---|---|---|
| 字体 | Noto Sans SC / Inter / JetBrains Mono | SIL OFL 1.1 |
| 平台图标 | Simple Icons | CC0 1.0（品牌归各平台） |
| 功能图标 | Lucide | ISC |
| SIM 卡图标 | Material Symbols | Apache 2.0 |
| 地图 | Natural Earth / world-atlas | Public Domain |
| 音乐 | Kevin MacLeod | CC BY 4.0（需署名） |
| 品牌 | 作者提供 | 作者所有 |

## video-shotcraft 镜头卡

| 项 | 内容 |
|---|---|
| 来源 | `D:\Files\AI_Vedio\0_镜头动效库\video-shotcraft\references\shots` |
| 引入时间 | 2026-11-05 |
| 许可 | **Apache License 2.0**（全文见 `common/shots/LICENSE`，署名见 `common/shots/ATTRIBUTION.md`） |
| 已引入 | 124 张镜头卡（.md）+ ATTRIBUTION.md |
| 未引入 | `demos/` 下的 152 个 tsx 与 `_fixtures/`、Ink Press 模板 |
| 性质 | 卡片是**方法与判例**，不是可运行代码。参数按 1920×1080 横屏标定，竖屏需重标 |

分十类：camera 10、effects 15、transition 15、typography 22、ui-entrance 21、interaction 11、opening 11、rhythm 8、outro 6、data 5。

Apache 2.0 允许商用与修改，但分发时必须保留 LICENSE 与 ATTRIBUTION。若将来引入 demo 源码，同样需要保留这两份文件。

## 可选但未引入

| 来源 | 许可 | 说明 |
|---|---|---|
| `D:\Files\AI_Vedio\0_镜头动效库\onetake` | **PolyForm Noncommercial 1.0.0**（仅限非商业） | 只借鉴了它的**方法**（节奏方差、边界承接、跟踪运镜），**没有引入任何代码**。其中 `lib/motion.js`、`templates/comp.html` 等如要用于商业项目，必须先取得作者授权。 |
| `D:\Files\AI_Vedio\remotion-产品演示模板` | MIT | 完整的 Remotion 产品片模板（engine/primitives/scenes），横屏 1920×1080、Remotion 4.0.451。需要产品演示镜头时再按需移植，不要整包覆盖。 |

## 方法借鉴记录

`onetake` 的三条判断被用进了早期的 9 秒实验片（已清理），均为自行实现：

1. **节奏**：镜头长度变异系数 ≥ 0.25；至少一记快打、一段收。demo 的镜头长度为 2.53 / 1.73 / 1.47 / 1.87 / 0.67 / 2.07 秒，变异系数 0.33。
2. **承接（carry）**：每个边界都要有元素活下来并移动。demo 用一个贯穿全片的光点，从 9 的右下角 → 面板之间 → 扫描线 → 下划线 → 金条 → 收尾圆环。
3. **运镜**：跟随要略领先于主体（约 0.1s）、落地要有沉降。demo 用了两个不同频率的缓慢摆动做手持感，落地由场景内弹簧接管。

## 版本

| 包 | 版本 | 说明 |
|---|---|---|
| remotion / @remotion/cli | 4.0.539 | 以 `package.json` 与实际 `node_modules` 为准 |
| react / react-dom | 19.2.3 | |
| typescript | 5.9.3 | |

升级 Remotion 后必须重跑 `npm run typecheck`、`npm run stills`，不要只改版本号。
