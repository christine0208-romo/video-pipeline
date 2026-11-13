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

## 4.1 新增或修改 recipe

1. 在 `src/generated/recipes.json` 增加条目：`id / code / name / engine / preset / layer / beatRoles / durationFrames / params / axes`。
2. `preset` 只能是已注册的组件（当前 `text-atom`、`transition-atom`、`particle-atom`、`camera-scene`）。
3. `axes` 里的 `palette / seed / text / keyword / countTo` 会按变体序号取值。
4. 在 `config/pipeline.json` 的 `generate.recipes` 加入 id。
5. `node run.mjs generate --recipe <id> --variants 1 --force`。
6. 看 `out/stills/assets/`，再 `node run.mjs generate --review --status draft`。
7. 通过后 `node run.mjs generate --approve <id>` 或 `--approve all`。
8. 更新 `docs/MODULES.md` 与 `docs/MOTION_PROMPTS.md`。

## 4.2 审核与退役

```bash
node run.mjs generate --review --status draft
node run.mjs generate --approve <id,...>
node run.mjs generate --reject <id,...>
```

- `draft` 不会进入混剪；`approved` 才会。
- `retired` 保留文件，不参与混剪；需要重新启用时再 approve。
- `--approve all` 只批准当前所有 draft；`--reject all` 只退役当前所有 draft。
- 临时预览未审核素材：`node run.mjs mix --allow-draft ...`。

## 4.3 音效与 BGM

- 音效索引：`common/assets/sfx/index.json`；BGM 索引：`common/assets/music/index.json`。
- 默认 `mix.music` 为 `auto`，`mix.sfx.enabled` 为 `true`。
- 关闭：`--no-music` / `--no-sfx`；指定：`--music auto|<id>|<path>`。
- 新增、替换、归一化和选曲规则见 `docs/AUDIO.md`。

## 4.4 裂变作品

```bash
# 默认：用 shared 素材库编排，不生成新素材
node run.mjs fission --works 3 --seed 20261108 --duration 12

# 需要作品专属素材时才生成
node run.mjs fission --work t1 --duration 6 --with-assets --per-layer 1,1,1

node run.mjs mix --work work-t1 --duration 6
node run.mjs generate --list-works
node run.mjs generate --share <id,...>
node run.mjs generate --clean-work work-t1
```

- 默认 `fission.generateAssets = false`：只用 shared + 实拍库；`--per-layer` 在默认模式下会被忽略。
- `--with-assets` 才按 work seed 从 recipe pool 选材，素材 `scope=work`，自动 `approved`。
- `mix --work` 不再强制专属素材；需要时加 `--require-work-asset`。
- 不同 work 专属素材相互隔离；`--share` 才进入 shared。
- `--clean-work` 默认 dry-run，`--force` 才删除。
- 生成素材分类/完整性规则见 `docs/ASSETS.md`。
- 详见 `docs/FISSION.md`。

## 4.5 质量与覆盖

```bash
node run.mjs quality
node run.mjs quality --force
node run.mjs quality --report-only
node run.mjs quality --edl mix-20261119-1
node run.mjs quality --strict
```

- `generate` / `fission` 渲染后自动分析；`quality` 可单独重算或复查。
- 报告：`data/quality/report.json`、`out/quality/report.md`。
- 近似重复先判断是否共用底图（camera 系 recipe 与其 base preset 会聚在一起），不是所有近邻都要改。
- `quality.ok = false` 的素材默认不进入混剪；`--allow-low-quality` 只做预览。
- 详见 `docs/QUALITY.md`。

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
node run.mjs mix --duration 12 --seed 20261108 --shot-length 2.4 --dry-run
node run.mjs check
```

- 镜头节奏：`mix.shotLength.min/max` 定目标镜头长度，`beatJitter` 给每作品抖动，`minShots/maxShots` 定数量范围。
- CLI：`--shot-length N`、`--shot-min N`、`--shot-max N`、`--beat-jitter N`、`--min-shots N`、`--max-shots N`。
- 节拍是叙事窗口，镜头可以跨节拍；看 EDL 时以 `shot.at/dur` 为准。

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

## 8.1 运行目录与安全迁移

复制仓库后先检查静态投影，不要直接删除 `public/`：

```bash
node run.mjs public
node run.mjs public --apply
```

`--apply` 只会隔离空实体目录；非空冲突需要人工确认和 `--force`。缓存/检查产物使用：

```bash
node run.mjs cache list
node run.mjs cache clean
node run.mjs cache clean --force
```

核心框架、项目 manifest 和外部输入的边界见 `config/components.json` 与项目 `project.json`。`data/`、`out/`、`public/` 都是运行区域，不应作为核心源码包提交。

## 9. 渲染与复查

```bash
node run.mjs generate --only platform-orbit --variants 1
node run.mjs generate --recipe text-char-rise,transition-glitch --variants 1 --force
node run.mjs generate --review --status draft
node run.mjs generate --approve all
node run.mjs quality --report-only
node run.mjs mix --duration 12 --outputs 1 --seed 20261108 --dry-run
node run.mjs mix --duration 12 --outputs 1 --seed 20261108
node run.mjs mix --duration 12 --music auto --no-sfx
```

- 静帧：`out/stills/`。
- 分段：`out/segments/`。
- 成片：`out/mix-*.mp4`。
- 透明素材：`out/assets/*.webm`。
- 音频：看 `data/edl/mix-*.json` 的 `audio.music` 与 `audio.sfx`；成片 `ffprobe` 应有音频流。

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
