# WORKFLOW

## 1. 新会话开工

```bash
npm run doctor
node run.mjs scan
```

- 读 `STATUS.md`、`docs/LESSONS.md`、`docs/RULES.md`。
- 看 `config/pipeline.json` 的 roots 与 spec。
- 看 `data/library.json` 的条数与 `data/catalog.json` 的条数。

## 2. 新增/更换实拍素材

1. 把素材放进任意一个 `footage.roots`；可加多个 root。
2. 需要人工标签时，在 root 下放 `tags.json`：
   ```json
   {
     "card-show-3.mp4": {
       "platform": "WhatsApp",
       "subjects": ["SIM卡", "手机"],
       "focus": [0.5, 0.42],
       "usable": [{ "start": 1.2, "end": 6.4 }]
     }
   }
   ```
3. `node run.mjs scan`。
4. 看 `data/thumbs/*-sheet.jpg` 与 `data/library.json` 的标签。
5. 新增素材默认会进 `library.json`；缺失素材标 `missing`，不会删除旧记录。

## 3. 新增实拍标签规则

改 `modules/lib/tagger.mjs` 的字典：

- `PLATFORMS`：平台名与关键词；
- `SUBJECTS` / `ACTIONS` / `MOODS` / `SCALES`：标签与关键词。

短英文词（≤4 字符）走词边界匹配，避免 `ig` 命中 `signup`。中文按子串匹配。

改完跑 `node run.mjs scan`；未变素材也会重新打标。

## 4. 新增生成 preset

1. 在 `src/generated/presets/` 新建 `<id>.tsx`，组件接收 `PresetProps`。
2. 在 `src/generated/presets.json` 登记 `{ id, supportsAlpha, description }`。
3. 在 `src/generated/registry.ts` 的 `COMPONENTS` 映射中注册。
4. 在 `modules/generate/catalog.mjs` 的 `variantProps()` 里加变体参数（图标组、配色、seed）。
5. `node run.mjs generate --only <id> --variants 1`。
6. 看 `out/stills/assets/` 静帧；需要透明叠加时检查 WebM alpha。
7. 更新 `docs/MODULES.md` 与 `docs/LESSONS.md`（如有新坑）。

命名：preset id 用 kebab-case，不用中文；画面上不出现内部标签。

## 5. 新增混剪规则

改 `modules/mix/planner.mjs`：

- `FOCUSES` / `ZOOMS` / `MOTIONS` / `SPEEDS` / `GRADES` / `OVERLAYS`：视觉变体池。
- `focusFor()`：带 crop 素材的焦点策略。
- `planBeats()`：节拍比例。
- `decideKind` 逻辑在 `planOutput()` 内：决定实拍/生成片段。
- `pickFootageShot()`：源区间与素材选择。
- `pickGeneratedShot()` / `pickOverlay()`：生成片段与叠加。

任何新规则都要在 `modules/mix/uniqueness.mjs` 加校验，或者在 `docs/DECISIONS.md` 写清为什么不需要。

改完：

```bash
node run.mjs mix --duration 12 --outputs 2 --seed 20261108 --dry-run
node run.mjs check
```

通过后再实渲。

## 6. 新增依赖

1. 先查 `docs/DEPENDENCIES.md` 的候选表。
2. 安装并锁版本。
3. 做 3 帧双渲染逐字节一致测试（或说明为什么不需要）。
4. 在 `docs/dependencies.json` 的 `approved` 登记：版本、用途、许可、确定性结论。
5. 在 `docs/DEPENDENCIES.md` 表格加一行。
6. `npm run check`。

## 7. 升级上游 common

`common/` 是快照。升级时：

1. 备份当前 `common/`。
2. 整目录替换 `common/{engine,components,vendor,assets,shots}`。
3. `npm run doctor`。
4. `npm run typecheck`。
5. `node run.mjs generate --variants 1 --force`，看静帧。
6. `node run.mjs mix --duration 12 --outputs 1 --dry-run`。
7. 更新 `CREDITS.md` / `docs/DEPENDENCIES.md`（如有新资源/依赖）。

## 8. 重置运行数据

```bash
rm -rf data out public
```

然后：

```bash
node run.mjs scan
node run.mjs generate
node run.mjs mix
```

只重置去重记录：

```bash
rm data/edl/signatures.json
```

## 9. 渲染与复查

```bash
node run.mjs generate --only platform-orbit --variants 1
node run.mjs mix --duration 12 --outputs 1 --seed 20261108 --dry-run
node run.mjs mix --duration 12 --outputs 1 --seed 20261108
```

- 静帧：`out/stills/`。
- 分段：`out/segments/`。
- 成片：`out/mix-*.mp4`。
- 透明素材：`out/assets/*.webm`。

## 10. 提交前

```bash
npm run check
npm run typecheck
node run.mjs check
```

- 更新 `STATUS.md`。
- 有新坑追加 `docs/LESSONS.md`。
- 新组件更新 `docs/MODULES.md`。
- 新素材更新 `CREDITS.md` 与 `REGISTRY.json`。
- 不提交 `data/`、`out/`、`public/`、`node_modules/`。

## 11. 调试一条 EDL

- 看 `data/edl/mix-*.json` 的 `beats[].shots[]`：
  - `kind`：`footage` / `generated`；
  - `assetId`、`src`、`in`、`dur`、`speed`；
  - `transform.focus/zoom/motion/grade/overlay`；
  - `overlay`：透明叠加；
  - `signature`：去重签名。
- 看 `out/stills/<id>/frame-*.png` 的构图。
- 看 `out/segments/<id>/seg-*/still-*.png` 的分段检查帧。
- 对比两条 EDL 的 `signature` 与 `(assetId, in, dur)`，确认没有重复。
