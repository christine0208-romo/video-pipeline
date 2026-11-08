# ONBOARDING · 10 分钟上手

新会话或新同事，按这个顺序走一遍。

## 1. 环境（1 分钟）

```bash
npm run doctor
```

看到 `体检通过` 再继续。缺 ffmpeg / 浏览器 / 依赖，按提示修。

## 2. 看配置（1 分钟）

打开 `config/pipeline.json`：

- `footage.roots`：实拍素材在哪；
- `spec`：1080×1920 / 30fps；
- `generate.presets`：启用哪些生成素材；
- `mix`：成片时长、条数、seed、节拍。

## 3. 扫描（2 分钟）

```bash
node run.mjs scan
```

打开 `data/library.json`，看：

- `assets[].id`：素材 id；
- `duration/width/height/fps`：元数据；
- `crop`：有效画面区域；
- `scenes[]`：可用镜头区间；
- `tags`：自动/人工标签；
- `thumbs`：缩略图路径。

再看 `data/thumbs/*-sheet.jpg`，确认画面内容与标签一致。

## 4. 生成一类素材（3 分钟）

```bash
node run.mjs generate --only platform-orbit --variants 1
```

看：

- `out/assets/platform-orbit-*.mp4`
- `out/assets/platform-orbit-*.webm`
- `out/stills/assets/platform-orbit-*.png`

确认构图、图标、配色。透明 WebM 用 `alphaextract` 验证，或直接看它叠在实拍上的效果。

## 5. 规划一条成片（2 分钟）

```bash
node run.mjs mix --duration 12 --outputs 1 --seed 20261108 --dry-run
```

打开 `data/edl/mix-20261108-1.json`：

- `beats[]`：hook / build / proof / turn / close；
- `shots[]`：`kind`、`assetId`、`in`、`dur`、`transform`、`overlay`、`signature`；
- `stills`：关键帧位置。

看 `node run.mjs check` 是否通过。

## 6. 实渲一条（3 分钟）

```bash
node run.mjs mix --duration 12 --outputs 1 --seed 20261108
```

看：

- `out/stills/mix-20261108-1/frame-*.png`
- `out/segments/mix-20261108-1/seg-*/still-*.png`
- `out/mix-20261108-1.mp4`

## 7. 记住三件事

1. **实拍是事实，生成是示意**；示意画面标「示意」。
2. **动画只来自帧**；不要用真实时间或 `Math.random`。
3. **改配置或源码，再重跑 stage**；不要手改 `data/`。

## 8. 接下来去哪

- 想改选镜：`modules/mix/planner.mjs`。
- 想加 preset：`src/generated/presets/` + `presets.json` + `registry.ts`。
- 想加标签：`modules/lib/tagger.mjs`。
- 想加依赖：`docs/DEPENDENCIES.md`。
- 遇到坑：先看 `docs/LESSONS.md` 与 `docs/TROUBLESHOOTING.md`。
- 任务结束：更新 `STATUS.md`，有新坑追加 `docs/LESSONS.md`，跑 `npm run check`。
