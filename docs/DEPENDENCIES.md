# DEPENDENCIES

## 政策

1. 顺序：Remotion 官方包 → 成熟第三方库 → `common/vendor` / `common/engine` → 自己写。
2. 新增依赖必须锁版本，并在 `docs/dependencies.json` 的 `approved` 登记。
3. 动画相关依赖必须先做确定性测试：同一 composition 渲染 frame 0/15/30 两次，逐字节一致；不一致只能作设计参考。
4. 未登记的依赖 `npm run check` 会失败。
5. 不引入需要联网运行时（CDN、在线字体、远程 API）的依赖；工作区要能离线渲染。

## 已安装

| 包 | 版本 | 用途 | 许可 |
|---|---|---|---|
| `remotion` | 4.0.539 | 视频框架、`OffthreadVideo`、`Audio`、`Sequence` | Remotion License |
| `@remotion/cli` | 4.0.539 | 渲染与 Studio CLI | Remotion License |
| `@remotion/paths` | 4.0.539 | vendored 动效库的路径测量/沿线运动 | MIT |
| `react` | 19.2.3 | 组件运行时 | MIT |
| `react-dom` | 19.2.3 | DOM 渲染 | MIT |
| `lucide-react` | 1.69.0 | 通用图标 | ISC |
| `typescript` | 5.9.3 | 类型检查 | Apache-2.0 |
| `@types/react` | 19.2.7 | React 类型 | MIT |
| `@types/web` | 0.0.166 | DOM 类型 | MIT |

## 候选（未安装）

只有在确实需要时才引入，并走登记流程：

| 包 | 用途 | 备注 |
|---|---|---|
| `@remotion/shapes` | 圆、三角、星形等几何 | 现在用 div/SVG/Canvas 足够；引入后替换手绘 |
| `@remotion/noise` | 确定性噪声 | 现在用 `keyedRandom` 与 Canvas 引擎；需要更自然的纹理时引入 |
| `@remotion/motion-blur` | 运动模糊 | 现在用速度/缩放表达动感；需要真实快门拖影时引入 |
| `@remotion/transitions` | 转场库 | 现在用自定义帧驱动转场；shader 型转场已知超时，慎用 |
| `@remotion/media` | 媒体组件 | `remotion` 核心已够用 |
| `@remotion/layout-utils` | 文本测量 | 需要中文自适应排版时引入 |
| `recharts` / `d3` | 图表 | 需要数据可视化时引入，先做 3 帧测试 |
| `three` + `@react-three/fiber` | 3D | 需要 3D 场景时引入 |
| `maplibre-gl` / `d3-geo` | 地图 | 现在用点阵地图；需要真实地理投影时引入 |

## 确定性测试流程

1. 新建一个最小 composition，使用该依赖的核心 API。
2. 渲染 frame 0、15、30 两次（`remotion still`）。
3. 对 PNG 做 `sha256` 对比。
4. 结果写进 `docs/dependencies.json` 的 `deterministic` 字段。
5. 若不一致，寻找确定性用法（固定 seed、禁用 CSS 动画、避免真实时间）。

## 登记流程

- 安装：`npm install <pkg>@<exact-version>`。
- `docs/dependencies.json` 加条目：`version / purpose / license / deterministic`。
- 本文件表格加一行。
- 若封装组件，更新 `docs/MODULES.md`。
- `npm run check` 必须通过。

## 核心与可选运行环境

核心框架需要：

| 类别 | 要求 | 用途 |
|---|---|---|
| Node.js | >= 22（建议由 fnm 管理） | CLI、Remotion、工作台 |
| ffmpeg / ffprobe | PATH 或 `config/pipeline.json.tools` | 探测、抽帧、编码、质量分析 |
| libvpx-vp9 | ffmpeg 编解码器 | 透明 WebM alpha |
| Chrome / headless shell | Remotion 可调用 | 浏览器渲染 |
| npm | 使用 `package-lock.json` | 安装核心 npm 依赖 |

可选项目环境：

| 工具 | 适用项目 | 备注 |
|---|---|---|
| uv / uvx + Python 3.12 | `sim-card-promo` TTS | 只有重新生成 edge-tts 音频时需要 |
| 网络访问 | `sim-card-promo` TTS | 运行时调用 Microsoft edge-tts；也可提供预生成 voiceover |

核心安装不包含实拍素材、`data/`、`out/`、`public/` 或 `node_modules/`；项目依赖见 `config/components.json` 和各项目的 `project.json`。

| 工具 | 版本 | 用途 | 备注 |
|---|---|---|---|
| `edge-tts`（uvx） | 7.3.1 | `projects/sim-card-promo` 的 TTS 口播 | 需要联网调用微软语音服务；只用于离线生成音频，不进入 Remotion 运行时；不写入 `package.json` |

- 不把 TTS 作为渲染依赖；生成后的 `voiceover.wav` 是普通音频文件。
- 换机器/离线环境时，需要提前生成 TTS 或替换为已有音频。
