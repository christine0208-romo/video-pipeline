# STATUS

- 状态：独立工作区已建立，并完成首次全流程验证。
- 建立日期：2026-11-08
- 当前规格：1080×1920 / 30fps
- 当前素材根：`D:/Files/AI_Vedio/1_素材库/vedio`
- 当前生成目录：6 个 preset，每类 1 组（首次验证用）
- 当前混剪默认：30 秒 / 1 条 / 静音 / 每类 2 组变体（配置默认值）

## 已完成

- 独立目录、自有 `package.json`、本地 `node_modules`、git 仓库已初始化。
- 上游 `common/{engine,components,vendor,assets,shots}` 已完整搬入。
- `src/platform.ts` 与 `src/assets.ts` 已改为本地路径。
- 一键入口、配置、doctor、check、规则与经验文档。
- 首次验证：
  - `scan`：26 条实拍 / 29 个场景 / 缩略图与接触表正常。
  - `generate --variants 1`：6 类素材，6 个 MP4 + 5 个透明 WebM。
  - `mix --duration 12 --outputs 2 --seed 20261108`：两条 12 秒成片。
  - 跨条素材源区间重叠 0；14 个镜头签名全部唯一。
  - `npm run doctor`、`npm run check`、`npm run typecheck`、`node run.mjs check` 均通过。

## 待办

- 生成每类第二组变体（默认配置要求 2 组）：`node run.mjs generate`。
- 可选：启用背景音乐（`mix.music`），并确认 CC BY 署名。
- 可选：跑一条 30 秒成片作为默认交付样例。
- 可选：把上游镜头卡索引接入 preset 文档，标注每个 preset 参考的镜头卡。
- 可选：提交初始 git 版本。

## 已知限制

- 静止展示类实拍通常只有 1 个场景，混剪差异来自源区间与裁切，不依赖场景数。
- 透明 WebM 的 `ffprobe` 显示 `yuv420p + ALPHA_MODE=1`，这是 VP9 alpha 的正常表示。
- 素材不足时去重会降级，日志和 EDL 会标出 `relaxed`。
- 默认静音；音乐需在配置里指定并确认许可。
- `common/` 是上游快照，不在这里直接改；升级时整目录替换并重新验证。


## 已知限制

- 静止展示类实拍通常只有 1 个场景，混剪差异来自源区间与裁切，不依赖场景数。
- 透明 WebM 的 `ffprobe` 显示 `yuv420p + ALPHA_MODE=1`，这是 VP9 alpha 的正常表示。
- 素材不足时去重会降级，日志和 EDL 会标出 `relaxed`。
- 默认静音；音乐需在配置里指定并确认许可。
- `common/` 是上游快照，不在这里直接改；升级时整目录替换并重新验证。
