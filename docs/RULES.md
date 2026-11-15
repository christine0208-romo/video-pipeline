# RULES

本文件是细则；`CLAUDE.md` 是入口。冲突时以 `CLAUDE.md` 的六条硬规则为准。

## 1. 确定性

- `src/` 内所有动画只来自 `useCurrentFrame()` / `useVideoConfig()`。
- 禁止 `Date.now()`、`new Date()`、`Math.random()`。`npm run check` 会扫描 `src/`。
- 随机值用 `keyedRandom(seed, key)`（`common/engine` 导出）或 Canvas 引擎的 `rng(seed)`。
- Canvas 每帧整幅重绘，不保留跨帧状态。
- 字体必须经过 `useFonts(FONT_MANIFEST)` 门（清单来自 `creative/registry`）；不要依赖系统字体。
- 新依赖先做 3 帧双渲染逐字节一致测试，再登记。

## 2. 实拍与生成

- 实拍素材是事实来源；生成片段是示意。
- 生成片段不能冒充真实操作、真实账号、真实结果。
- 手机界面、短信、通话、账号页等示意画面必须带「示意」标记。
- 品牌图标只作类别示意，不表示合作或背书。
- 生成片段可以叠加在实拍上，但不要在画面上加「来源/出处」角标；来源只进 `CREDITS.md`。
- 每条成片至少有一个实拍镜头；`turn` 至少有一个生成片段。

## 3. 配置与数据

- 所有可变参数走 `config/pipeline.json` 或 CLI；不要在模块里写死路径、时长、preset。
- CLI 覆盖配置；配置覆盖默认值。
- `data/`、`out/`、`public/` 是运行产物，不手工编辑，不提交。
- 要改选镜结果，改 `modules/mix/planner.mjs` 或配置，然后重跑 `mix`。
- 要重置跨成片去重记录，删除 `data/edl/signatures.json` 后重跑。

## 4. 素材与许可

- 先查素材库 `assets/`（`assets.roots` 可配多根）、`common/vendor`、`creative/shared/shots`；没有再新增。
- 素材二进制不入库：新增文件后运行 `node tools/assets.mjs scan --apply` 登记到 `creative/shared/assets.manifest.json`，再补 license 并更新 `creative/shared/CREDITS.md`；用户可用 `npm run assets:fetch -- --from <dir>` 部署。
- 新增图标/字体/地图/音乐/纹理：
  - 放进素材根（默认 `assets/`，或 `assets.roots` 里的任一根）；
  - `assets scan --apply` 登记（默认 `license=unknown`，必须人工补）；
  - 写入 `creative/shared/CREDITS.md`；
  - 许可不清楚的不用；`assets check --strict` 会拦住未登记许可的条目。
- 音效与 BGM 必须来自 CC0 或明确许可来源；CC BY 曲目发布时必须保留署名。
- 音效登记 `creative/shared/audio/sfx.index.json`；BGM 登记 `creative/shared/audio/music.index.json`。
- 音乐默认 auto 选曲；SFX 默认开启，但密度要克制（12 秒 ≤ 12 个）。
- Work 素材 `scope=work`，普通 `mix` 只用 shared；跨作品复用必须 `--share` 手动提升。
- 不自动清理 work 素材；`--clean-work` 默认 dry-run，`--force` 才删除。
- 裂变作品的差异优先来自版式/背景/光色/文案/镜头/节奏等独立轴；不要只靠增加变体或换 seed。
- variation profile 写入 catalog 与 EDL；提升 shared 后保留 profile，便于追溯。
- 品牌图标只从 Simple Icons 等明确许可的来源取；不自行绘制平台 logo。
- 音乐默认静音；启用时确认 CC BY 等署名要求。
- 不把第三方截图/素材当成自有实拍；需要时标「示意」并记录来源。

## 5. 代码与复用

- 复用顺序：Remotion 官方包 → 成熟第三方库 → `common/vendor` / `common/engine` → 自己写。
- 图标用 `lucide-react` 或素材库 `assets/icons`；不要手绘 SVG 图标。创意里写相对路径（`icons/x.svg`）即可，系统会解析到 public 的 `assets/`。
- 路径与曲线用 `@remotion/paths` 或现有 canvas 引擎；不要手搓复杂路径。
- 同一版式第二次出现才提取到 `creative/shared/parts.tsx` 或 `common/engine`；提取后更新 `docs/MODULES.md`。
- 不写同义组件（`fadeUp` / `revealTitle` 之类）；已有能力优先。
- 新动效优先在现有创意引擎里加 style / 参数；只有现有引擎无法表达时才新增 preset / engine。
- 生成素材默认 `draft`；先在 `out/stills/assets/` 复查，再 `creative review --status approved`；混剪只消费 `approved`。
- 转场原子用透明 WebM，挂到 `shot.transitionAsset`；有转场原子时不要再叠加 CSS `TransitionFx`。
- 新依赖必须登记 `docs/dependencies.json` 与 `docs/DEPENDENCIES.md`。

## 6. 渲染闸门

- 生成素材：先 `creative plan` / `creative build --dry-run`，再看 `out/stills/assets/` 的静帧；通过后 `creative review --status approved`。
- 混剪：`mix` 自动先出关键帧，再分 3 段抽帧，最后全片。
- `--allow-draft` 只用于预览，不用于正式出片。
- 音频：先看 EDL 的 `audio.sfx` 是否过密；再看音乐是否在 SFX 下 duck；成片 `ffprobe` 必须有音频流。
- 裂变：先 `fission --dry-run` 看 work 素材，再实际生成；fission 串行，不要并发跑多个 Remotion。
- 发现构图/节奏问题，先改代码或配置，再重跑；不要直接全片重渲。
- 生成素材按 `引擎 + props` 缓存；只有改组件或参数才需要 `--force`。
- 生成/裂变后确认 `quality` 已写入；`node run.mjs quality --report-only` 看近似重复与覆盖。
- `quality.ok = false` 的素材不进入正式成片；`--allow-low-quality` 只用于预览。
- 同一条成片内默认做感知去重；除非明确需要，不要关 `--no-perceptual-dedupe`。
- 提交前可跑 `node run.mjs quality --strict`；共用底图的 camera 系素材被判近邻是预期行为，需人工判断。
- 渲染前确认 ffmpeg/浏览器可用；`npm run doctor` 先跑。

## 7. 性能

- 扫描是增量的：未变素材不重探、不重出缩略图。
- 场景检测解码整条视频；大批量素材可先 `--limit` 试跑，或临时关 `sceneSplit`。
- 生成素材缓存：不要无脑 `--force`。
- 混剪先 `--dry-run` 看 EDL，再实渲。
- 不并发跑多个 Remotion 渲染；CPU 争抢会让两个都变慢。

## 8. Windows 与编码

- 路径统一用 `POSIX()` 转成 `/` 再写进 JSON/EDL。
- 中文文件名通过 `staticFile` 自动编码；不要预先 `encodeURIComponent`。
- 目录链接用 junction（Node `symlinkSync(..., "junction")`）；不要用拷贝替代。
- `public/` 链接已存在但指向别处时，代码会拒绝覆盖；先人工检查，不要删除用户数据。
- Python 如需使用，走 `uv run --python 3.12 python ...`；不要假设 `python` 在 PATH。

## 9. 画面与文案

- 文案不是字幕；文字是画面的一部分。
- 不把「开场 / 背景 / 要点 / 证据 / 但是 / 结论」等内部标签印上屏。
- 不把分镜描述词、制作者备注印上屏。
- 不写绝对说法（「一定」「百分百」）；CTA 直接指向主页。
- 不把来源角标、平台声明贴在画面上；只进 `CREDITS.md`。

## 10. 提交前检查

- `npm run check`：文件、确定性、素材、依赖、public 链接、EDL。
- `npm run typecheck`。
- `node run.mjs check`：已有 EDL 的签名/区间/时长。
- 看一遍本段静帧；至少抽 3 帧。
- 更新 `STATUS.md`；有新坑追加 `docs/LESSONS.md`。
