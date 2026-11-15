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
- `creative`：创意工程目录、构建格式与裂变素材池；
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
- `thumbs`：缩略图路径。

再看 `data/thumbs/*-sheet.jpg`，确认画面内容与缩略图一致。

## 4. 构建一类创意素材（3 分钟）

```bash
node run.mjs creative scan
node run.mjs creative build --creative scene-orbit
```

看：

- `out/assets/scene-orbit-*.mp4`
- `out/assets/scene-orbit-*.webm`
- `out/stills/assets/scene-orbit-*.png`

确认构图、图标、配色。透明 WebM 用 `alphaextract` 验证，或直接看它叠在实拍上的效果。参数与变体在 `creative/scene-orbit/` 里改；工作台 `#/creative` 可视化编辑。

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
- 想加引擎：默认在创意工程的 `engine/` 放 `engine.json` + `index.tsx`；被复用后再移到 `creative/engines/`，最后跑 `creative scan --write-registry`。
- 想加创意：在 `creative/` 新建工程与变体，跑 `creative validate` / `creative build`；审核用 `creative review --status`。
- 想裂变作品：`node run.mjs fission`；作品素材隔离、缓存与清理见 `docs/FISSION.md`。
- 想调裂变差异：改 `creative/shared/variation.json` 的版式/背景/光色/文案/节奏轴。
- 想查观感重复 / 覆盖：`node run.mjs quality`，看 `out/quality/report.md`；规则见 `docs/QUALITY.md`。
- 想用可视化工作台：`npm run workbench`，打开 `http://127.0.0.1:4317/`；见 `docs/WORKBENCH.md`。
- 想加音效/BGM：先看 `docs/AUDIO.md`，再登记 `creative/shared/audio/{sfx,music}.index.json`。
- 想加动效：先看 `docs/MOTION_PROMPTS.md` 的 90 条库与竖屏换算。
- 想加依赖：`docs/DEPENDENCIES.md`。
- 遇到坑：先看 `docs/LESSONS.md` 与 `docs/TROUBLESHOOTING.md`。
- 任务结束：更新 `STATUS.md`，有新坑追加 `docs/LESSONS.md`，跑 `npm run check`。
