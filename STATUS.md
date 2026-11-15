# STATUS

- 状态：P0 / P1 已验收；P2 裂变 + 多轴 variation + 感知质量层 + 镜头节奏 + 本地 Web 工作台 + 生成素材解耦/分类/完整性检查已落地并验证。
- 建立日期：2026-11-08
- 当前规格：1080×1920 / 30fps
- 当前素材根：`D:/Files/AI_Vedio/1_素材库/vedio`
- 当前生成目录：92 条 catalog（70 approved + 13 draft + 9 retired）；霓虹系列共 14 条（`platform-icons-neon` 7 + `platform-icons-neon-global` 7）。
- 当前成片：`out/sim-card-promo.mp4`，33.56s，1080×1920 / 30fps / H.264 + AAC；TTS + BGM，-16.7 LUFS / -1.4 dBFS。
- 当前混剪默认：30 秒 / 1 条 / 自动 BGM / SFX 开启 / 每类 2 组变体 / 质量闸门 + 同片感知去重开启 / 目标镜头长度 1.4–2.6 秒 + 每作品节拍抖动 15%

## 会话交接（2026-11-08 · 质量层 + 镜头节奏 + 素材解耦）

- 本轮完成：P2 感知质量层。
  - `modules/lib/vision.mjs`：ffmpeg 抽 32px 原始帧，JS 实现 2D DCT pHash、alpha 覆盖率、运动能量、亮度/对比度、平均色。
  - `modules/quality/{analyze,similarity,report,index}.mjs`：catalog `quality` 写回、感知聚类、近似重复、覆盖矩阵、报告。
  - CLI：`node run.mjs quality [--force|--report-only|--list|--strict|--edl <id>|--layer|--scope|--work]`。
  - `generate` / `fission` 渲染后自动分析；planner 默认跳过 `quality.ok=false`，并在同一条成片内做感知去重。
  - 新文档 `docs/QUALITY.md`；新增 ADR-016 与 3 条 LESSONS。
- 当前 catalog：92 条（83 活跃 + 9 退役）全部有 `quality`；45 感知簇，多样性 0.542，130 对近似重复，0 条质量失败，5 条 `faint-alpha`/`static` 警告。
- 霓虹图标系列：`platform-icons-neon`（I01，overlay / icon / shared，3s，cyber 色板）。seriesIndex 0 为基础散布，1..6 为 WhatsApp / Telegram / WeChat / LINE / Discord / Instagram；故障在第 30 帧（1.0s）爆发，含 RGB 色散、切片、冲击环；基础款静态是预期行为。
- 全球平台霓虹系列：`platform-icons-neon-global`（I02），seriesIndex 0 基础，1..6 为 ChatGPT / Instagram / Facebook / Telegram / X / WhatsApp；故障在第 12 帧（0.4s）爆发，用于逐词踩点。
- SIM 卡推广片：`projects/sim-card-promo/`；`out/sim-card-promo.mp4` 33.56s，19 镜头，TTS 29.756s（zh-CN-YunxiNeural +60%），片尾 CTA 叠在压暗 SIM 卡实拍上、无口播；BGM `aeris-horizon-monolith`（CC0），-16.7 LUFS / -1.4 dBFS。
- 素材取舍：T08 `text-count` / P05 `particle-flow` 标记 `disabled` 并移出 `generate.recipes`；现有 9 条相关素材退役。相似素材按 `series` 聚组，`seriesIndex` 表变体；工作台支持“按系列分组”，默认隐藏退役素材。
- 生成素材解耦：`fission` 默认只用 shared 素材库，不生成 work 素材；`--with-assets` 才生成。`mix --work` 不再强制专属素材，`requireWorkAsset` 默认关闭。
- 素材分类/完整性：catalog 增加 `category / series / seriesIndex / loop`；质量增加 `firstLastHamming / endMotion / alphaEnd` 与 `loop-mismatch / end-unsettled / end-residue`。`icon-morph` 改为完整循环（首尾 Hamming 2/0），`particle-orbs` / `particle-dust` 改为整数周期循环。
- 工作台：分类、状态、质量标记改为中文展示，并增加类型筛选。
- 工作台：`npm run workbench`，`http://127.0.0.1:4317/`；概览 / 素材 / 任务 / 成片 / 质量五页；单任务队列、SSE 实时日志、取消、Range 视频预览、素材 approve/reject/share/clean-work；文档 `docs/WORKBENCH.md`，ADR-018。
- 批量裂变：`work-20261121-1..3`（seed 20261121，6 秒，每层 1/2/2）各 5 条 work 素材，成片 1080×1920 / 30fps / 6.016s / H.264 + AAC；profile 分别为 ember+hook-first+cards、ocean+punchy+showcase、lime+punchy+signup。
- 镜头节奏重构：`planBeats` 每作品抖动 ±15%；`planShotSegments` 按 `shotLength.min/max` 定目标镜头数，合并中间节拍（保护 turn/close），拆分过长镜头并长短交替；EDL 允许空 beat、镜头跨节拍。
- 重出 3 条：`work-20261121-1..3` 均从 5 镜头降为 4 镜头，镜头时长分别 1.30/3.03/1.07/0.60、1.07/2.80/1.33/0.80、1.27/2.50/1.40/0.83 秒。
- 当前报告：`data/quality/report.json`、`out/quality/report.md`。
- 新会话开工：读本文件、`docs/ASSETS.md`、`docs/QUALITY.md`、`docs/WORKBENCH.md`、`docs/FISSION.md`、`docs/AUDIO.md`、`docs/MOTION_PROMPTS.md`；跑 `npm run doctor`、`npm run check`、`npm run typecheck`、`node run.mjs check`、`node run.mjs quality --report-only`。
- 继续开发：等用户的生成素材设计稿，细化 category / series / cue 与踩点策略；工作台第二阶段（批量任务表、发布打包、manifest）；品牌基线；生成每类第二组变体。
- 注意：改动未提交 git；`data/`、`out/`、`public/` 是运行产物；`node run.mjs quality --force` 会重新抽帧并写回 catalog。

## 已完成

- 独立目录、自有 `package.json`、本地 `node_modules`、git 仓库已初始化。
- 上游 `common/{engine,components,vendor,assets,shots}` 已完整搬入。
- `src/platform.ts` 与 `src/assets.ts` 已改为本地路径。
- 一键入口、配置、doctor、check、规则与经验文档。
- 新增 `docs/MOTION_PROMPTS.md`：9 类 90 条动效提示词库、经验总结、竖屏适配与配方字段。
- P0 生成素材层：
  - `data/catalog.json` 增加 `layer / sceneCapable / overlayCapable / transitionCapable / status / beatRoles / recipeId / source / quality / usage`。
  - `src/generated/recipes.json` 注册 8 条 recipe（T01 / T03 / T06 / T08 / X01 / X02 / X08 / X10）。
  - 新增 `text-atom` 与 `transition-atom` 两个 preset 组件；`modules/generate/recipes.mjs` 负责展开变体。
  - 新增 `generate --review / --approve / --reject`；新素材默认 `draft`，混剪只消费 `approved`，`--allow-draft` 可临时预览。
  - 混剪接入 `transitionAsset`；有转场时叠加延后到转场结束。
- 首次验证：
  - `scan`：26 条实拍 / 29 个场景 / 缩略图与接触表正常。
  - `generate --variants 1`：6 类素材，6 个 MP4 + 5 个透明 WebM。
  - `mix --duration 12 --outputs 2 --seed 20261108`：两条 12 秒成片。
  - 跨条素材源区间重叠 0；14 个镜头签名全部唯一。
  - `npm run doctor`、`npm run check`、`npm run typecheck`、`node run.mjs check` 均通过。
- P0 验证：
  - 8 条 recipe 渲染成功（MP4 + 透明 WebM + 静帧）。
  - `generate --review --status draft` → `--approve all` 通过。
  - 12 秒混剪选入 `text-keyword` 叠加和 wipe / flash / glitch / light-leak 转场；成片抽帧确认覆盖与文字可读。
  - `npm run check`、`npm run typecheck` 通过。
- P1 音效与 BGM：
  - `common/assets/sfx/index.json`：13 个 Kenney CC0 音效，本地转 48kHz WAV、-18 LUFS。
  - `common/assets/music/index.json`：3 首 AERIS MUSIC CC0 + 2 首 Kevin MacLeod CC BY。
  - EDL 音频扩展为 `{ music, sfx[] }`；`beatFrames` 来自选中曲目的 BPM。
  - 音乐按叙事角色做能量曲线，SFX 活跃时 duck；SFX 按转场、文字叠加、UI mock 和回合点落点。
  - 设计规则、来源与响度见 `docs/AUDIO.md`。
- P1 生成引擎：
  - `particle-atom`：P01 漂浮尘埃 / P04 流体光球 / P05 噪声流场。
  - `camera-scene`：C01 推近 / C02 抖动 / C06 快速变焦 / C09 拉远，包装现有 scene。
- P2 裂变：
  - `fission` 从完整 recipe pool 按 workSeed 选 scene / overlay / transition，生成独立素材。
  - catalog 增加 `scope / workId / workSeed / sharedAt`；work 素材自动 `approved`，仅对所属 work 可见。
  - `mix --work` 只用 shared + 当前 work；planner 优先 work-local，并要求至少使用一条 work 素材。
  - `--share` 提升 shared；`--list-works` 查看；`--clean-work` 默认 dry-run，`--force` 删除。
  - 文档 `docs/FISSION.md`，`tools/check.mjs` 纳入必检。
- P2 多轴 variation：
  - `src/generated/variation.json` + `modules/generate/variation.mjs`。
  - 调色板扩到 10；文本版式/背景/光位/字体/文案；粒子分布/背景/色组；镜头底图/icons/post/grade；转场角度/强度；时长档；节奏 profile；实拍主题。
  - profile 写入 catalog `variation` 与 EDL `variation` / `workProfile`；fission 写 `data/works/<id>.config.json`。
- P2 感知质量层：
  - `modules/lib/vision.mjs`：ffmpeg `rawvideo` 抽帧；32×32 灰度 2D DCT pHash；alpha / 运动 / 亮度 / 对比度 / 平均色。
  - `modules/quality/*`：`quality` 写回 catalog；同层帧对齐 Hamming + 颜色得到观感相似度；感知聚类；近似重复；覆盖矩阵；JSON/Markdown 报告。
  - `generate` / `fission` 自动分析；`node run.mjs quality` 单独分析/报告；`--edl` 检查单条成片。
  - 混剪质量闸门：默认跳过 `quality.ok = false`；`mix.perceptualDedupe` 默认开启，同片内跳过与已用素材观感过近的候选。
  - `--allow-low-quality` / `--no-perceptual-dedupe` 可临时放开；`quality --strict` 可用于提交前检查。
  - 文档 `docs/QUALITY.md`；`docs/DECISIONS.md` ADR-016；`docs/LESSONS.md` 追加 VP9 alpha、缩放 alpha 阈值、variation 扁平字段三条。
- P2 镜头节奏：
  - `planBeats` 增加 `beatJitter`，每个作品对节拍时长做 ±15% 抖动并归一化。
  - 新增 `planShotSegments`：按 `mix.shotLength.min/max` 与 `mix.minShots/maxShots` 定镜头数；先合并中间节拍（保护 turn / close），再拆分超过 `maxLen × 1.8` 的镜头；拆分按 0.56/0.44 长短交替。
  - `turnHint` 只保留在包含 turn 的第一段，避免拆出连续生成镜头。
  - EDL `beats[]` 保持叙事窗口，`beats[].shots[]` 按镜头起点归属，允许空数组；`stills` 跳过空 beat。
  - CLI：`--shot-length / --shot-min / --shot-max / --beat-jitter / --min-shots / --max-shots`。
  - 文档 `docs/DECISIONS.md` ADR-017；`docs/LESSONS.md` 追加“叙事节拍不等于剪辑点”。
- 本地 Web 工作台：
  - `workbench/server.mjs`：Node 原生 `http`，只绑定 `127.0.0.1`；素材/成片/质量 API；单任务队列；日志落盘 + SSE；Range 媒体；取消子进程树。
  - `workbench/public/*`：概览、素材、任务、成片、质量五页；任务表单覆盖 scan/generate/quality/mix/fission/check；素材 approve/reject/share/clean-work。
  - `npm run workbench` / `npm run workbench:open`；`.claude/launch.json` 提供预览配置。
  - 文档 `docs/WORKBENCH.md`；ADR-018；LESSONS 追加浏览器与 Node 流两处文件锁。
- 生成素材解耦与完整性：
  - `fission.generateAssets` 默认 `false`；`--with-assets` 才生成作品专属素材；`mix.requireWorkAsset` 默认 `false`。
  - catalog 增加 `category / series / seriesIndex / loop`；presets 声明分类，recipe 按 engine 推导。
  - 质量增加 `firstLastHamming`（精确首尾帧）、`endMotion`（精确末两帧）、`alphaEnd`；按类型标记 `loop-mismatch` / `end-unsettled` / `end-residue`。
  - `icon-morph` 按完整循环重写；`particle-orbs` / `particle-dust` 改为整数周期；共享与 work-20261121-3 素材已重渲。
  - 文档 `docs/ASSETS.md`；ADR-019；工作台分类/状态/质量标记中文展示，并增加类型筛选。
- 素材取舍与系列分组：
  - T08 `text-count` / P05 `particle-flow` 标记 `disabled: true`，移出 `generate.recipes` 与默认值；现有 9 条素材 `--reject` 退役。
  - recipe 素材 `series = recipe.id`、preset 素材 `series = preset.id`，`seriesIndex` 记录变体序号；icon-morph 保持 `platform-icons` 系列。
  - 工作台素材默认筛选 `approved`，新增“按系列分组”；卡片显示系列/变体，模态框显示系列与完整指标。
- 霓虹平台图标故障系列：
  - 新增 `icon-glitch-scatter` preset 与 `platform-icons-neon` recipe（I01），`cyber` 调色板。
  - 7 个变体：基础 + 6 个单平台故障；统一布局、深度/模糊、透视网格、扫描线、RGB 色散、切片与冲击环。
  - 故障爆发固定在第 30 帧（1.0s），便于 BGM/文案踩点；`series = platform-icons-neon`，`seriesIndex` 0..6。
  - 7 条已 `approved`；工作台按系列分组显示为 7 个变体。
- SIM 卡推广片：
  - `projects/sim-card-promo/tts.mjs`：edge-tts（uvx）逐句生成 + 时间轴 + `voiceover.wav`。
  - `projects/sim-card-promo/build.mjs`：脚本化 EDL、9 个自定义文字叠加、片尾 CTA 叠在 SIM 卡实拍、渲染与 BGM/TTS 混音。
  - `platform-icons-neon-global` 系列 7 条（基础 + 6 平台），故障 0.4s，品牌色图标，用于逐词踩点。
  - 成片 `out/sim-card-promo.mp4`：33.56s / 19 镜头 / 1080×1920 / 30fps / H.264 + AAC；TTS 29.756s，BGM 0.15，loudnorm -16.7 LUFS。
  - 项目说明 `projects/sim-card-promo/README.md`。

## 验收记录

- 2026-11-08 · P0 验收通过
  - 环境：`npm run doctor` 0 警告；素材库 26 条，生成目录 14 条。
  - 元数据：14 条全部 `approved`（6 scene / 4 overlay / 4 transition）；`layer / sceneCapable / overlayCapable / transitionCapable / beatRoles / source / quality / usage` 无缺失。
  - 审核闸门：合成目录测试，默认 10 个 seed 下 draft 叠加/转场出现 0 次；`--allow-draft` 下各出现 6 次。
  - 混剪：12 秒 EDL 6 镜头（5 实拍 / 1 生成），13 个素材引用全部 approved；成片 1080×1920 / 30fps / 12.000s / H.264。
  - 抽帧：wipe / flash / glitch / light-leak / 文字关键词高亮 / 网格叠加均正常。
  - 校验：`npm run check`、`npm run typecheck`、`node run.mjs check` 通过。
  - 验收脚本：`out/checks/accept-p0-gate.mjs`（临时脚本，不在流水线内）。
- 2026-11-08 · P1 验证
  - 7 条 particle / camera recipe 渲染并批准；catalog 21 条全部 `approved`。
  - `mix-20261117-1`：hook 使用 `particle-orbs` 叠加（`blend: screen`），turn 使用 `camera-zoom`；camera 镜头 `motion = still`，避免二次运镜。
  - BGM 自动选中 Afterglow Vast（84 BPM, CC0）；12 个 SFX 落在转场、文字高亮和回合点；`beatFrames = 21`。
  - 踩坑：`public/audio` 文件符号链接导致 Remotion 音频渲染 `kill EPERM`；改用 `public/music` 目录路径后，30 帧 BGM + SFX 测试通过。
  - 首版成片 -27.4 LUFS 偏低；调整 `music.volume = 0.6`、`sfx.volume = 1.4`、`duckTo = 0.22` 后重渲。
  - 最终成片 `out/mix-20261117-1.mp4`：1080×1920 / 30fps / 12s / H.264 + AAC；-20.9 LUFS integrated，峰值 -5.97 dBFS。
  - 校验：`npm run check`、`npm run typecheck`、`node run.mjs check` 通过。
- 2026-11-08 · P1 验收通过
  - 环境：`npm run doctor` 0 警告；`npm run check`、`npm run typecheck`、`node run.mjs check` 通过。
  - 音频逻辑：`out/checks/accept-p1.mjs` 27/27；默认选曲、`--no-music`、`--no-sfx`、指定曲目、情绪、BPM、SFX 落点、素材存在全部通过。
  - 素材：SFX 13 个（0 缺失，12 类）；BGM 5 首（3 CC0 + 2 CC BY，0 缺失）。
  - 成片：1080×1920 / 30fps / 12.011s / H.264 + AAC；-20.9 LUFS integrated，峰值 -5.97 dBFS。
  - catalog 21 条全部 `approved`；camera `motion = still`；particle `blend = screen`；EDL 12 个 SFX / `beatFrames = 21`。
- 2026-11-08 · P2 裂变验证
  - `work-t1`：3 条 work 素材（camera-shake / text-char-rise / transition-light-leak）；EDL `ownWorkAssets = 3`；成片 1080×1920 / 30fps / 6.016s / H.264 + AAC。
  - `work-t2` dry-run：选中 camera-zoom / particle-flow / transition-flash，素材 ID 与 t1 不同。
  - 普通 `mix`（seed 20261118）0 条 work 引用；`--list-works` 显示 t1 3 条素材与产出。
  - 重跑 t1 dry-run：3 条 work 素材均命中缓存（“已存在”）。
  - 合成目录测试：share / clean-work 9/9；clean 只删 work 文件，保留 shared 与其他 work。
  - `npm run check`、`npm run typecheck`、`node run.mjs check` 通过。
- 2026-11-08 · P2 多轴 variation 验证
  - `accept-fission-variation.mjs` 42/42：6 个 seed 命中 5 种 palette、4 种节奏、3 种素材主题、2 种文本背景、3 种镜头底图、4 种转场角度。
  - work-t3 profile `punchy` / `mixed`；EDL `ownWorkAssets = 3`；文本 left / none 背景 / top-right 光位；camera platform-orbit + scanline；transition angle 12。
  - work-t3 与 t1 使用不同 recipe、palette、文本版式/背景、camera base/post、节奏。
  - work-t3 成片：1080×1920 / 30fps / 6.016s / H.264 + AAC / 4.4 MB。
  - `--list-works`：work-t1 / work-t3 各 3 条素材，EDL 与成片均存在。
  - 普通 `mix` 0 条 work 引用；`npm run check`、`npm run typecheck`、`node run.mjs check` 通过。
- 2026-11-08 · P2 感知质量层验证
  - `node run.mjs quality`：27 条全部分析；21 感知簇；多样性 0.778；6 对近似重复；1 条 `faint-alpha` 警告（`particle-dust`，alpha 0.0026）。
  - 按层：overlay 9/9 簇、scene 12/7 簇、transition 6/5 簇；scene 主要重复来自 camera 系 recipe 与它们的 base preset。
  - 近似重复：`transition-light-leak` shared 与 work-t1 完全一致（score 1）；`network-universe` ↔ `camera-shake` 0.963；`platform-orbit` ↔ `camera-push` 0.927。
  - 覆盖矩阵：palette × layer、recipe × palette、engine × layer、scope × layer 均生成；variation 轴在 work-t3 上读到 left / none / platform-orbit / scanline / punchy / mixed。
  - `quality --edl mix-20261119-1` / `-2`：13 / 10 条生成素材，0 对同片近似重复。
  - `mix --duration 30 --outputs 2 --seed 20261119 --dry-run`：13 镜头 × 2 通过；已有 9 条 EDL 全部通过 `node run.mjs check`。
  - `generate` 自动分析验证：清除一条 `quality` 后重跑 `--only platform-orbit --variants 1`，日志显示“质量分析 1 条”。
  - `npm run check`、`npm run typecheck`、`node run.mjs check` 通过。
- 2026-11-08 · 批量裂变 3 个作品验证
  - `node run.mjs fission --works 3 --seed 20261121 --duration 6 --per-layer 1,2,2`：3/3 完成，15 条 work 素材，0 失败。
  - 成片 `out/work-20261121-1.mp4` / `-2.mp4` / `-3.mp4`：均 1080×1920 / 30fps / 6.016s / H.264 + AAC；5 镜头，实拍 3/4/4。
  - 质量：42 条全部分析；33 感知簇；多样性 0.786；10 对近似重复；0 条 `ok=false`；2 条 `faint-alpha` 警告。
  - 修正：alpha 覆盖率改用 96px 宽单独采样（`alphaSampleWidth`），避免 32px pHash 缩放误杀极淡粒子；`QUALITY_VERSION` 升到 2。
  - `npm run check`、`npm run typecheck`、`node run.mjs check` 通过。
- 2026-11-08 · 镜头节奏重构验证
  - 6 秒 dry-run（默认 shotLength 1.4–2.6）：4 镜头，典型 0.9 / 3.4 / 1.0 / 0.7 秒；不同 seed 时长不同。
  - 12 秒：5 镜头，1.70 / 3.37 / 3.87 / 2.03 / 1.03 秒；30 秒：12 镜头，1.27–4.10 秒，长短分布明显。
  - punchy（1.2–2.0）与 slow-build（2.2–3.8）6 秒均为 4 镜头，但中段时长不同。
  - 重出 `work-20261121-1..3`：均 4 镜头 / 3 实拍 / 1 生成；时长分别 1.30/3.03/1.07/0.60、1.07/2.80/1.33/0.80、1.27/2.50/1.40/0.83 秒。
  - 三条成片仍为 1080×1920 / 30fps / 6.016s / H.264 + AAC；`npm run check`、`npm run typecheck`、`node run.mjs check` 通过。
- 2026-11-09 · 本地 Web 工作台验证
  - `npm run workbench`：`http://127.0.0.1:4317/` 概览、素材、任务、成片、质量五页加载正常。
  - 素材页：57 条生成素材与 26 条实拍素材可筛选、看静帧/视频；资产弹窗可操作 approve/reject/share/clean-work。
  - 任务页：通过 UI 运行 quality（57 条，0 失败）与 mix dry-run；SSE 日志、状态、队列正常；generate --force 31.5s 通过。
  - 成片页：播放器 Range 正常；修复预览文件锁后，先播放素材再 `generate --force` 覆盖成功。
  - 质量页：57 条报告、44 簇、13 对近似重复、4 条警告；目录与报告数量一致。
  - 文件锁：浏览器预览 + Node `createReadStream` 会持有 `out/*.mp4`；已改为任务前释放视频、`res.close` 时销毁流；直接命令行覆盖渲染 171.5s 通过。
  - `npm run check`、`npm run typecheck`、`node run.mjs check` 通过。
- 2026-11-09 · 生成素材解耦与完整性验证
  - `fission --works 1 --seed 20261150 --duration 6 --dry-run`：日志 `assets=shared`，不生成 work 素材；work config 正常写出。
  - `mix --config ... --work work-20261150-1 --dry-run`：提示“没有专属素材，使用 shared 素材库”，规划通过。
  - catalog 78 条全部分析：0 条质量失败，5 条警告（4 条 faint-alpha / 1 条 static）。
  - `icon-morph` 两个变体首尾 Hamming 2 / 0；`particle-orbs` 两个变体 0；`particle-dust` 循环通过。
  - 共享 particle-orbs / particle-dust 已重渲；work-20261121-3 的 5 条素材已用新组件重渲。
  - 工作台素材页：类型、状态、质量标记中文展示；新增类型筛选；质量页 78 条 / 0 失败 / 5 警告。
  - `npm run check`、`npm run typecheck`、`node run.mjs check` 通过。
- 2026-11-09 · 素材取舍与系列分组验证
  - 9 条 `text-count` / `particle-flow` 素材退役；`readRecipes` 跳过 `disabled`，`generate.recipes` 已移除两项。
  - 质量报告：69 条活跃素材，44 感知簇，0 失败，3 条 `faint-alpha` 警告。
  - 工作台默认“活跃（不含退役）”：69 条可见，`text-count` / `particle-flow` 不再出现；按系列分组 19 个系列。
  - “按系列分组”：19 个系列，camera / transition / text / icon 等变体聚合；卡片显示系列与变体号。
  - `npm run check`、`npm run typecheck`、`node run.mjs check` 通过。
- 2026-11-09 · 霓虹平台图标故障系列验证
  - `generate --recipe platform-icons-neon --force`：7 条变体全部渲染成功，MP4 + 透明 WebM + 静帧；已批准。
  - 人工抽帧：基础款为霓虹散布；WhatsApp / LINE 故障帧可见 RGB 色散、横切、冲击环；图标为亮白霓虹，位置/深度稳定。
  - 质量：7 条无失败；基础款 `static` 警告（预期），其余无标记。
  - 工作台按系列分组：`platform-icons-neon` 显示 7 个变体；当前活跃素材 76 条 / 20 个系列。
  - `npm run check`、`npm run typecheck`、`node run.mjs check` 通过。
- 2026-11-10 · SIM 卡推广片验证
  - TTS：15 段，`zh-CN-YunxiNeural` +60%，voiceover 29.756s；片尾未配音。
  - 画面：19 镜头，逐句对应；S1 使用 `platform-icons-neon-global` 品牌色图标逐平台故障；S3–S6 使用 SIM 卡实拍 + 自定义文字；片尾 CTA 叠在压暗 SIM 卡实拍上。
  - 成片：33.56s / 1080×1920 / 30fps / H.264 + AAC，22 MB；混音 -16.7 LUFS，峰值 -1.4 dBFS。
  - 抽帧：0.8s ChatGPT 叠加、9.0s 注册文案、14.8s 国内直邮、20.4s 完成验证、26.0s 片尾文字均正常。
  - 渲染曾在中途被会话中断（735/827 帧）；续跑后完成。
  - `npm run check`、`npm run typecheck`、`node run.mjs check` 通过。

## 待办

- 工作台第二阶段：批量任务表、发布打包（`release/<batch>/` + manifest + 封面 + CSV）、上传能力单独评估。
- 建立品牌基线：保留一套必须一致的字体/留白/色调规则，避免变化轴过多导致作品失去识别度。
- 生成每类第二组变体：`node run.mjs generate`。
- 可选：把上游镜头卡索引接入 preset 文档。

## 已知限制

- 静止展示类实拍通常只有 1 个场景，混剪差异来自源区间与裁切。
- 透明 WebM 的 `ffprobe` 显示 `yuv420p + ALPHA_MODE=1`，这是 VP9 alpha 的正常表示。
- 素材不足时去重会降级，日志和 EDL 会标出 `relaxed`。
- `common/` 是上游快照，不在这里直接改；升级时整目录替换并重新验证。
- 文字文案来自 `src/generated/variation.json` 的 10 条 copy 池；仍可能重复，后续接入按主题生成的文案源。
- 转场原子只在镜头开头播放，尚未做镜头末尾或双段转场。
- EDL 的 `beats[]` 是叙事窗口，`beats[].shots[]` 可能为空，镜头可以跨节拍；排查时以 `shot.at/dur` 为准。
- 目标镜头长度是近似值；节拍边界、最短镜头约束、转场和 `maxLen × 1.8` 的拆分会拉动实际时长。
- `quality` 已实现 pHash / alpha 覆盖率 / 运动能量 / 亮度对比度 / 平均色与 flags；pHash 对纯色极简画面区分度有限，仍需人工抽帧复查。
- 质量分析每段素材多 1–2 次 ffmpeg 抽帧；27 条约数秒，work 批量裂变时会线性增长。
- BGM 自动选曲是规则评分，不是人工试听；最终成片仍建议人工听一遍。
- `CameraScene` 的 `basePreset` 列表需要手动维护。
- 粒子使用 DOM / SVG；数量大时渲染成本上升。
- 默认混音约 -21 LUFS；需要更响可在配置里提高 `music.volume` / `sfx.volume`。
- CC BY 曲目（Crypto / Floating Cities）发布时必须保留署名。
- Recipe 池只是“动词”；差异主要来自 variation 轴的版式 / 背景 / 光色 / 文案 / 镜头 / 节奏 / 素材主题，以及 recipe 选择。继续加 recipe 仍有价值，但不是唯一杠杆。
- 每个 work 素材需要 MP4 + 可选 WebM + 2 静帧；fission 串行渲染，耗时不短。
- `--clean-work` 只删素材，不删作品成片和 EDL；删除前会提示仍引用这些素材的 EDL。
- Work 素材跨作品复用只能通过 `--share` 手动提升；提升后失去一次性隔离。
- 变化轴已经很多；感知去重默认开启（同片内 + 质量闸门），但跨成片仍可能撞画面，需要看 `quality` 报告的近似重复对。
- 变化轴过多会稀释品牌识别度，需要保留字体、留白、主色等基线。
- 生成素材分类目前是初步体系（text/icon/transition/particle/camera/ui/graphic）；`series` 已用于 `icon-morph`、`platform-icons-neon`、`platform-icons-neon-global`；`cueRole/cueOffset` 等踩点字段尚未接入 planner，目前靠素材起点和代码里的 0.4s/1.0s 故障爆发手动对齐。
- 转场“完整”没有统一自动判定：`end-residue` 只在显式 `complete = clear` 时检查，否则只记录 `alphaEnd` 指标。
- 83 条活跃素材有 130 对近似重复，主要来自同 recipe 的变体、两组霓虹系列共用布局和 camera 系共用底图；需要人工判断是否保留。
- SIM 卡推广片 33.56s；按用户要求放慢到 +60%，时长比最初 20s 目标长；如果还要更紧凑，可后期 atempo 或删减文案。
- TTS 是逐句时间轴，没有词级字幕；具体镜头与句子的对应写在 `projects/sim-card-promo/build.mjs`，改文案后需要同步改 shots。
- 工作台只监听 `127.0.0.1`，无登录/权限；一次只跑一个任务；通过 API 直接提交任务不会自动释放视频预览句柄。
- 工作台还没有发布/上传；新增 CLI stage 时需要同步更新前端表单 schema。
- 实拍标签较稀疏：多数素材只有“展示”，素材主题过滤可能回退全池。

## 2026-11-13 · 架构边界与运行目录收敛

- `config/pipeline.json` 增加 `runtime`（public/cache/temp/release）和 `tools`，`modules/lib/config.mjs` 不再复制整份业务默认配置。
- 新增 `config/pipeline.schema.json`、`tools/check-config.mjs`：校验配置范围、beat ratio、preset/recipe、组件 registry、variation camera bases 和项目 manifest。
- `fission` 改为使用已解析的 effective config，不再重新读取原始 pipeline 配置，避免丢失 CLI 覆盖。
- 新增 `node run.mjs public`：默认报告；`--apply` 安全隔离空实体 public 目录并创建 junction；本次已备份并恢复 assets/generated/thumbs/music 四个空目录，外部 footage 根缺失所以未创建链接。
- 新增 `node run.mjs cache list|clean [--force]`，管理 `.cache/video-pipeline`、`out/checks`、`out/downloads`；默认 list/dry-run，不触碰 data、approved 资产、实拍或成片。
- 新增 `config/components.json`、`config/parameters.json`、`projects/sim-card-promo/project.json`；工作台新增 `/api/config`、`/api/parameters`、`/api/components`，任务默认值来自当前配置。
- `npm run typecheck`、`node tools/check-config.mjs`、`node run.mjs check`、`node run.mjs quality --report-only` 通过；`npm run check` 现仅将缺失 footage 根对应的旧实体目录报告为 warning，catalog 历史缺失媒体仍为 warning。
- 工作台浏览器验证：配置/参数 API 200、无控制台错误，任务页显示当前 duration/outputs/seed/shotLength 并生成正确命令预览。

## 2026-11-13 · 全新运行数据重建

- 实拍：配置的素材根不存在，`scan` 现在按 `intentionalEmpty` 生成空库；`data/library.json` 0 条，`footage.manifest.json` roots/assets 为空，并记录 `missingRoots`。
- 生成素材：旧 catalog 的 92 条全部指向旧机器绝对路径；`node run.mjs reindex --apply` 按当前 `out/assets` 92 个 MP4 / 74 个 WebM 重建路径，保留 70 approved / 13 draft / 9 retired 与质量数据；0 条丢弃。
- 旧 EDL：12 条全部引用已不存在的实拍，已 prune 其 EDL、成片、分段、分镜静帧；签名库重建为 0 条。
- 清理：`out/checks` 41MB、`public/footage/vedio` 空实体目录、旧 `out/sim-card-promo*`、`out/segments`、`.cache`、旧 `data/works` 配置、`data/workbench` 任务日志已移除。
- 保留：`out/assets`（92 MP4/74 WebM）、`out/stills/assets`（184 张，全部属于有效 catalog）、`out/tts`（项目 TTS 输入）、`data/edl/signatures.json`（空）、`data/migrations`（重建审计）。
- 验证：`npm run check`、`npm run typecheck`、`npm run doctor`（1 warning：素材根缺失）、`node run.mjs check`、`node run.mjs quality --report-only` 通过；工作台 `/api/status`、`/api/library`、`/api/catalog`、`/api/outputs` 均 200，实拍 0 / catalog 92 / 成片 0。
- 新命令：`node run.mjs reindex [--apply]`、`node run.mjs runtime list|clean [--apply] [--force]`、`node run.mjs runtime prune-edl [--apply]`。

## 2026-11-14 · 工作台前端重建

- 补回 `workbench/public/{index.html,app.js,styles.css}`（此前缺失，`npm run check` 报 3 个必需文件错误）。零依赖原生 JS，hash 路由五页：
  - 概览：实拍/生成/作品/成片计数，当前任务与队列，最近成片，质量摘要，每 6 秒轮询。
  - 素材：生成素材与实拍素材双页签；生成素材支持状态/类型/层/范围筛选、搜索、按系列分组；卡片显示状态与质量标记；弹窗含 MP4 预览、静帧切换、质量指标、变化轴、标签，以及 approve / reject / share / clean-work（dry-run）。
  - 任务：按 `config/parameters.json` 渲染字段，占位符取当前 `config/pipeline.json` 默认值，实时命令预览；提交后 SSE 实时日志、取消、最近任务。
  - 成片：列表、内嵌播放、时长/镜头数/大小、打开所在文件夹、复制路径。
  - 质量：摘要、分层表、质量标记、近似重复、覆盖矩阵（中文标题）、变化轴（过滤全 n/a 的轴）、感知聚类。
- 修复 `workbench/server.mjs` 的 `listLibrary`：实拍名称回退 `relPath`，`thumbs` 相对 `data/` 解析后再转 `/media/data/...`（此前全部为 null）。
- 修复 `.gitignore`：`public/` 改为 `/public/`（其余运行产物同样锚定仓库根）。此前该规则把 `workbench/public/` 一并忽略，前端文件从未进入提交。
- 浏览器验证（端口 4317）：五页加载、素材筛选/系列分组、资产弹窗与视频预览、任务页提交 `quality --report-only` 并收到 SSE 日志、质量页矩阵/轴/聚类渲染；控制台无错误。
- `npm run check`、`npm run typecheck`、`node run.mjs check` 通过。
- 当前运行数据未变：实拍 26 条、生成 52 条（12 approved / 40 draft）、无 EDL 与成片。

## 2026-11-14 · 创意工程 P0–P2（文字试点）

- 新增 `creative/`：`engines/text.json`（T01/T03/T06 参数声明）+ `text-display` 工程（3 个变体 / 6 条 items）。
- 新增 `modules/creative/{loader,params,compile,build,index}.mjs`：
  - loader 校验工程、引擎、style、参数类型/范围/enum 与 items；
  - compile 按「schema 默认 → 工程 params → 变体 params → item params」解析，产物带 `creativeId / variantId / creativeVersion / variantVersion / style / paramsHash`；
  - build 渲染 MP4 + 透明 WebM + 静帧、自动质量分析，并按 `creativeId + variantId` 对账：新 ID 插入，旧 ID 标 `retired`。
- 新 CLI：`node run.mjs creative scan|validate|plan|build|preview|review|reset`。
- 配置：`config/pipeline.json` 增加 `creative` 段；schema、`cfg.paths.creative`、check-config 同步。
- catalog：`makeEntry` 写入创意出处与 props `creative` 块；`reindex` 保留出处；planner 的单个上限改用 `creativeId ?? recipeId`；质量报告新增“创意工程”轴。
- 工作台：
  - 新增 `#/creative` 页：工程/变体列表、schema 驱动的参数控件、逐条文案编辑、保存、预览静帧、构建、批准/退役、构建版本与“参数已变化”提示；
  - API：`GET /api/creative`、`POST /api/creative/:id/variant/:vid`、`POST /api/creative/:id/{build,preview,review}`；
  - 素材页与资产弹窗显示创意出处；`ALLOWED_STAGES` 增加 `creative`。
- 验证：
  - `creative validate --strict` 0 错误 0 警告；`plan` 输出 6 条；`build --dry-run` 不写文件。
  - `creative build --creative text-display`：6 条素材、12 个渲染文件、质量 6 条全部通过、0 警告。
  - 工作台保存文案后版本 +1、显示“参数已变化”；预览静帧生成到 `out/creatives/text-display/char-rise/`；构建后旧 ID 自动 retired，新 ID 为 draft。
  - 批准该变体后，5 个 seed 的 `mix --dry-run` 中有 3 个选到 `text-display-*` 叠加。
  - 越界参数 `fontSize=999` 返回 400，变体文件未被修改。
  - `npm run check`、`npm run typecheck`、`node run.mjs check`、`node run.mjs quality --report-only` 通过。
- 当前数据：catalog 58 条（旧 52 + 创意 6，创意 6 条已批准；char-rise 的 2 条旧版本 retired）。旧 preset/recipe 生成路径尚未删除。
- 下一步：P4 迁移 transition / particle / camera / icon-neon，P5 迁移场景 preset，P6 裂变接入创意，P7 删除旧生成模式并清空重建。

## 2026-11-14 · 创意工程 P4–P5（其余引擎迁移）

- 新增 10 个引擎 schema：`transition / particle / camera / icon-glitch / platform-orbit / social-constellation / network-universe / kinetic-grid / icon-morph / ui-mock`，参数面与现有组件一一对应，style 可用 `defaults` 注入固定 props（如 `transition: "flash"`、`move: "push"`）。
- 新增 10 个创意工程：`transitions`（4 变体 / 8 条）、`particles`（2 / 4）、`camera-moves`（4 / 8）、`icon-neon`（2 / 14）、`scene-orbit`（1 / 2）、`scene-constellation`（1 / 2）、`scene-network`（1 / 2）、`scene-grid`（1 / 2）、`icon-morph`（1 / 2）、`ui-mock`（4 / 4）。
- 工作台创意页：
  - 支持 `stringList / numberList` 字段（图标、平台名按行编辑）；
  - 变体参数与 item 参数按字段类别拆分：文字/关键词/调色板/故障序号/数量/幅度按条编辑，图标/平台/后处理等按变体编辑；
  - 保存时以原对象为底合并，未渲染的 item 参数（如 seed、basePreset）不会被丢弃。
- 修复 `transition-atom` 的 glitch 末帧：RGB 叠加层增加 `opacity: fade`，消除 `end-residue`。
- 修复 `creative build --force` 的质量缓存：本次重渲的素材先置 `quality = null`，质量分析会重新计算，不再继承旧标记。
- 验证：
  - `creative validate --strict`：11 引擎 / 11 工程 / 0 错误 0 警告；
  - 全部工程构建成功：transitions 8、particles 4、camera 8、icon-neon 14、场景 8、icon-morph 2、ui-mock 4，失败 0；
  - 人工抽帧：擦除、尘埃、镜头拉远、霓虹故障、图标切换、图标环绕、账号界面示意均正常；
  - glitch 重建后 `end-residue` 清除；
  - 5 个 seed 的 `mix --dry-run` 均选到创意转场 / 场景 / 霓虹图标 / ui-mock 素材；
  - `npm run check`、`npm run typecheck`、`node run.mjs check`、`quality --report-only` 通过。
- 当前数据：catalog 111 条（旧 52 + 创意 59；创意 55 approved / 4 retired）。质量：已分析 107 条、32 簇、多样性 0.299、513 对近似重复（新旧并存导致）、8 条警告、0 条失败。
- 下一步：P6 裂变 `--with-assets` 接入创意变体池；P7 删除旧 `generate` 路径、清空重建。

## 2026-11-15 · 创意工程 P6–P7（裂变接入 + 删除旧模式 + 清空重建）

- P6 裂变接入创意：
  - `modules/creative/work.mjs` 从创意变体池按 layer 选材，按 workSeed 应用 `variation.json`（调色板/文案/粒子/镜头/转场/节奏/实拍主题），生成 `scope=work` 素材；
  - `fission --with-assets` 不再读 recipe pool；`fission.recipePool` 改为 `creative.pool`；
  - 验证：`fission --with-assets --per-layer 1,1,1` 实跑产出 3 条 work 素材与 6 秒成片，EDL 三个镜头分别来自 camera-moves / icon-neon / transitions。
- P7 删除旧生成模式：
  - 删除 `src/generated/recipes.json`、`modules/generate/{index,recipes,work}.mjs`；
  - `modules/generate/review.mjs` 移到 `modules/creative/review.mjs`，新增 `creative share / clean-work / list-works`；
  - `catalog.mjs` 删除 preset/recipe 构建与变体逻辑，只保留 `makeEntry`、`mergeCatalog`、`writeCatalog`、`readCatalog`、`reindexCatalog`、`inventoryGeneratedFiles`；
  - 配置删除 `generate` 段，新增 `creative.pool`；schema、`check-config`、`parameters.json`、`package.json`、工作台任务表单同步移除 generate；
  - 工作台资产 approve/reject/share/clean-work 改走 `creative` 命令。
- 切换与重建：
  - `node run.mjs creative reset --apply --force`：清空 114 条生成条目、`data/props`、`out/assets`、静帧、`out/creatives`、质量报告、EDL、works 配置；保留实拍索引、TTS 与已渲染成片；
  - 分 5 批 `creative build` 全量重建 55 条素材，0 失败；全部批准。
- 当前数据：catalog 55 条（全部 approved，全部来自创意工程）；质量 55 条已分析、26 簇、多样性 0.473、118 对近似重复、4 条警告、0 条失败。
- 验证：
  - 5 个 seed 的 `mix --dry-run` 只使用创意素材，覆盖文字/场景/转场/镜头/图标；
  - `fission --with-assets --dry-run` 正常；
  - 工作台任务页不再出现 generate，创意页 11 个工程正常，资产操作走 creative；
  - `npm run check`、`npm run typecheck`、`node run.mjs check`、`npm run doctor` 通过。
- 旧生成路径已完全移除；后续新增素材只需新增/修改 `creative/` 工程与变体。

## 2026-11-15 · 引擎实现迁入 creative（混合布局试点）

- 新增混合引擎布局：
  - 共享引擎包 `creative/engines/<engine>/`：`engine.json` + `index.tsx`（导出 `Component`）；
  - 创意本地引擎：`creative/<id>/engine.json` + `engine.tsx`，`creative.json` 写 `engine: "./engine"`；
  - `text` 引擎已迁到 `creative/engines/text/`；旧 `src/generated/atoms/text-atom.tsx`、旧 registry 与 `presets.json` 中的 `text-atom` 条目均已删除，loader 对共享引擎改为信任 `engine.json`，`check-config` 识别由 `creative/` 提供的 preset。
- 新增 `modules/creative/registry.mjs`：
  - 扫描共享引擎目录与本地引擎，生成 `creative/registry.ts`；
  - 命令 `node run.mjs creative scan --write-registry`，`--check-registry` 校验是否最新；
  - `src/GeneratedAsset.tsx` 合并旧注册表与创意注册表，迁移期两套并存。
- loader/compiler 支持两种引擎引用与本地引擎；
- `tools/check.mjs` 的确定性扫描扩展到 `creative/**/*.tsx`，并校验注册表最新。
- 验证：
  - `text-display` 的 plan / build 命中缓存，ID 不变；`creative preview` 通过新注册表渲染成功；
  - 临时本地引擎工程 `local-smoke`（`engine: "./engine"`）能 scan、plan、preview，验证后已删除；
  - `npm run typecheck`、`npm run check`、`creative validate --strict` 通过。
- 当前状态：text 为共享引擎包；其余 10 个引擎仍是 `creative/engines/<engine>.json` + `src/generated` 实现。后续按同一格式迁移，完成后删除 `presets.json`、旧 `registry.ts` 与旧 atoms/presets 实现。

## 2026-11-15 · 其余 10 个引擎迁入 creative

- 10 个引擎实现与 schema 迁到 `creative/engines/<engine>/`：
  - `transition`、`particle`、`camera`、`icon-glitch`、`platform-orbit`、`social-constellation`、`network-universe`、`kinetic-grid`、`icon-morph`、`ui-mock`；
  - 每个目录包含 `engine.json` 与 `index.tsx`，组件统一导出 `Component`；camera 的底图 import 改为兄弟引擎目录。
- 旧文件清理：
  - 删除 `src/generated/presets/*`、`src/generated/atoms/{transition-atom,particle-atom,camera-scene}.tsx`；
  - 删除 `src/generated/presets.json`、`src/generated/registry.ts`；
  - `src/generated` 只保留共享原语（assets / palette / parts / types / backdrop / easing）与 variation。
- 运行时与校验：
  - `GeneratedAsset` 只读 `creative/registry.ts`；
  - loader 去掉 legacy 扁平 schema 与 `presets.json` 依赖；
  - `reindex` 从 `creative/engines/*/engine.json` 读元数据；
  - `check-config` 校验引擎包完整性、registry 键集合与 variation camera bases。
- 验证：
  - 11 个引擎全部注册；逐个 preview 渲染成功（转场、粒子、镜头、霓虹图标、四个场景、图标切换、界面示意、文字）；
  - 11 个创意工程 / 55 条素材，ID 与 preset 键不变，无需重渲；
  - `npm run check`、`npm run typecheck`、`node run.mjs check`、`npm run doctor` 通过；
  - 工作台创意页 11 个工程、11 个引擎，无控制台错误。

## 2026-11-15 · 引擎改为本地优先

- 按“本地优先，复用再提升”重新分配 11 个引擎：
  - 本地实现（`creative/<id>/engine/`）：`text-display`、`transitions`、`particles`、`icon-neon`、`camera-moves`；
  - 共享实现（`creative/engines/`）：`platform-orbit`、`social-constellation`、`network-universe`、`kinetic-grid`、`icon-morph`、`ui-mock`——因为 camera 引擎把它们当作底图，是真实复用。
- 每个创意工程的意图、变体、引擎实现、README 现在在同一个文件夹里；`creative/engines/` 只留共享引擎与说明。
- 代码同步：
  - loader 的本地引擎路径改为 `<creative>/engine/engine.json` + `engine/index.tsx`，并保留 engine.json 的 `preset` 键；
  - registry 生成器同时扫描共享引擎与本地 `engine/`；
  - check-config 的本地引擎路径同步更新；
  - check.mjs 必需文件改为代表性本地引擎路径。
- 验证：
  - 11 个引擎逐个 preview 渲染成功；
  - 11 个创意工程 / 55 条素材，ID 与 preset 键不变；
  - `npm run check`、`npm run typecheck`、`node run.mjs check`、`npm run doctor` 通过。

## 2026-11-15 · 创意构建支持单条 item 与明确的缓存语义

- CLI 新增 `--item <id|序号>`：`creative plan|build|preview` 可只处理指定变体下的一条 item。
- item 级对账：构建单条时只 retire 该 item 的旧版本，同变体其他 items 不受影响。
- 工作台：每个 item 头部与产物行增加“构建 / 预览”按钮；原有“保存并构建”仍作用于当前变体。
- 修复保存版本策略：只有 `style / params / items / durationFrames / loop` 变化才升版；仅改状态或名称不再制造新素材，避免“保存一次就全量换 ID”。
- 缓存语义：
  - 参数与版本不变 → 同 ID 文件存在 → 缓存命中，不重渲、不新增；
  - 参数变化 → 新 ID 新增，旧 ID retired，文件保留；
  - `--force` → 同 ID 重渲覆盖，质量重算。
- 验证：`plan --item a` 输出 1 条；`preview --item b` 只渲染该条；`build --item a` 缓存命中且不影响 item b；typecheck、check 通过。

## 2026-11-15 · 清理 core 中的预设创意实现

- 删除 `common/components/`（含 `reel/v2/packs` 的 5 套导演式 pack、`Reel`、媒体层与 EDL 类型）；这些是创意内容，且核心代码零引用。
- 手机界面 clips（`GeneratedClip`：platform-icon / gate / sms / call / account）移入 `creative/engines/ui-mock/clips.tsx`，由 ui-mock 引擎本地引用；`GeneratedClipId` 一并迁走。
- `src/platform.ts` 不再导出 GeneratedClip，只保留 `common/engine`。
- 更新 CLAUDE、RULES、DEPENDENCIES、MODULES、CREDITS 中的 `common/components` 引用。
- 验证：`creative preview --creative ui-mock --variant account` 正常渲染；`npm run typecheck`、`npm run check` 通过。
- 当前 `common/` = `engine`（运动/字体/Canvas 原语）+ `vendor`（上游实现）+ `assets`（图标/字体/音乐等原始资源）+ `shots`（镜头卡文档）；core 不再包含任何具体创意画面。

## 2026-11-15 · creative 移出仓库 + 空核心初始化

- `.gitignore` 增加 `/creative/`：创意包与引擎实现作为内容包部署，不进核心仓库。
- 新增 `tools/init-creative.mjs`：
  - 没有 `creative/` 时创建目录并生成空 `creative/registry.ts`；
  - 有创意包但缺注册表时生成完整注册表；
  - 已有注册表默认不动，`--force` 才重写。
- `package.json` 增加 `postinstall` 与 `creative:init`；`npm ci` 后核心仓库即可 typecheck。
- 空核心校验：
  - `check.mjs` 先运行初始化，不再要求 creative 内容文件；
  - `check-config` 允许 creative 缺失，引擎包为空时跳过 variation camera bases 校验。
- 验证：
  - 临时移走 creative 后：`npm run typecheck`、`npm run check` 通过；`creative scan` 显示 0 引擎 / 0 工程，注册表为最新；
  - 恢复创意包后：11 个工程恢复，`creative scan --check-registry` 通过；
  - `npm run doctor` 0 警告。
- 当前：本地 `creative/` 仍在（被 gitignore），13 个文件组不随核心提交；新机器 clone 后由 postinstall 生成空注册表，部署创意包后再 `creative scan --write-registry`。

## 2026-11-15 · core 与创意/素材彻底分层

- 创意共用内容迁出 `src/`：
  - `palette.ts`、`parts.tsx`、`backdrop.tsx`、`assets.ts`、`icons.json`、`world-dots.json`、`variation.json` → `creative/shared/`；
  - `types.ts` → `src/types.ts`；`easing.ts` → `common/engine/easing.ts`；
  - `src/generated/` 已删除，core 不再含任何图标/调色板/点阵/文案轴。
- `src/assets.ts` 与 `src/generated/assets.json` 不再属于核心；引擎统一从 `creative/shared/` 读取。
- `variation.mjs` 改读 `creative/shared/variation.json`，缺失时使用内置最小默认值。
- 素材二进制移出仓库：
  - 新增 `config/assets.manifest.json`（82 条：66 条有稳定直链，16 条需用户提供）；
  - 新增 `tools/assets.mjs`：`check / verify / fetch / --from`；
  - `.gitignore` 忽略 `common/assets` 二进制，只保留 REGISTRY 与 sfx/music 索引；
  - 已用 `git rm --cached` 将字体/图标/音效/音乐/品牌二进制移出索引；
  - 音频 planner 在文件缺失时跳过对应 BGM/SFX。
- 空核心（无 creative、无素材）验证：typecheck 通过、check 通过、doctor 仅 1 条“素材未部署”警告；恢复后 11 个创意工程、82 条素材、注册表均正常。
- 当前 core：`run.mjs` + `modules/` + `src/` 运行时与类型 + `workbench/` + `tools/` + `config/` + `docs/` + `common/{engine,vendor,shots}` + 素材清单；无预设创意、无素材二进制。

- 补充：`FONT_MANIFEST` 移除未使用的 ZCOOL KuaiLe / 马善政字体；这两项作为可选用户素材保留在 `config/assets.manifest.json`，不再阻塞核心渲染。

## 2026-11-15 · PLAN-CORE-CLEAN 执行完成（A → B → C → D）

- 工作包 A · 核心类型去内容化：
  - `src/types.ts` 只留 `EngineProps / PresetMeta / AssetProps`；
  - 新建 `creative/shared/types.ts`：`PaletteName` + `TextProps / TransitionProps / ParticleProps / CameraProps / IconGlitchProps / IconSceneProps / UiMockProps`；
  - 11 个引擎改从 `../../shared/types` 取精确类型；`icon-neon` 的本地 `GlitchProps` 收敛为 `IconGlitchProps`；`camera-moves` 的 `BASES` 用 `React.FC<EngineProps>` + 断言；
  - `modules/creative/registry.mjs` 生成 `Component: React.FC<EngineProps>`；
  - `src/Root.tsx` 的默认 preset 改为 `PRESET_IDS[0] ?? ""`，core 不再写死引擎键；
  - 验收：临时新建一个带全新 props 的引擎 + 工程，未改 `src/` 即可 preview 渲染成功；55 条素材 ID 未变，无需重渲。
- 工作包 B · 素材/字体/音频清单迁入内容包：
  - `config/assets.manifest.json` → `creative/shared/assets.manifest.json`；`tools/assets.mjs` 重写：默认读内容包清单、`--manifest` 可指定、无清单时打印“无内容包”并退出 0；新增 `scan`（`--apply / --prune / --check`），`check --strict` 在 `license=unknown` 时失败；
  - `FONT_MANIFEST` → `creative/shared/fonts.ts`；`common/engine/fonts.ts` 只留 `useFonts / measureCN / FontSpec`；注册表 re-export 字体清单，缺失时导出空数组；`GeneratedAsset` 与 `MixVideo` 都从 `creative/registry` 取；
  - 音频索引 → `creative/shared/audio/{sfx,music}.index.json`，`music/LICENSES.md` → `creative/shared/audio/LICENSES.md`；音效、音乐文件仍在 `common/assets/{sfx,music}`；`modules/mix/planner.mjs` 改读内容包，索引缺失时静音；
  - `common/shots` → `creative/shared/shots/`；`common/assets/REGISTRY.json` → `creative/shared/REGISTRY.json`（历史归档，运行时不再读取）；素材许可段落 → `creative/shared/CREDITS.md`；
  - `.gitignore` 忽略整个 `/common/assets/`；`check` / `doctor` / `ensurePublicLinks` 对缺失素材容错；
  - `config/components.json` 删除 sim-card 项目条目与项目级工具声明。
- 工作包 C · 自动扫描与同步：
  - 新增 `tools/sync.mjs` / `node run.mjs sync`（`--apply` 写注册表 + 登记素材、`--check` 有差异退出 1、`--footage` 顺带 scan）；
  - `npm run check` 改为执行 `sync --check` + `assets check --verify`（只读）；
  - `creative build` 在注册表过期时自动重写；
  - 工作台新增 `GET/POST /api/sync`，创意页顶部显示注册表状态与素材差异（新增/变更/缺失），并有“同步内容”按钮（入队 `run.mjs sync --apply`）。
- 工作包 D · 项目扫描：
  - 新增 `modules/lib/projects.mjs`（`scanProjects`）与 `tools/projects.mjs` / `node run.mjs projects scan`；
  - `check-config` 改为扫描 `projects/*/project.json`，不再依赖 `components.projects`。
- 验证：
  - 空 core（临时移走 `creative/` 与 `common/assets`）：postinstall 生成空注册表；`assets:check` 退出 0；`sync --check` 通过；`typecheck`、`check` 通过；`doctor` 3 条警告 0 问题；`creative build` 报“没有可构建的素材”；
  - 全量内容：`assets:check` / `assets:verify` 82 条 0 缺失 0 哈希不符；`sync --apply` 无差异；`creative scan --check-registry` 最新；`creative build --text-display --dry-run` 正常；`typecheck`、`check`、`doctor`（0 警告）、`node run.mjs check` 通过；
  - 手动修改场景：新增引擎 → `sync` 报告过期、`--apply` 写入、preview 成功；删除引擎 → `sync --apply` 移除条目；新增素材 → scan 报新增、`--apply` 登记 `license=unknown`、`check --strict` 失败；替换素材内容 → scan 报哈希变化、`--apply` 更新；改变体 items → 不跑 sync，`creative plan` 立即从 2 条变 3 条；`--prune` 移除已删文件条目后清单回到 82 条；
  - 工作台（端口 4319）：创意页 11 个工程，顶部显示“注册表最新 / 素材 82 条 / 素材清单一致”；点击“同步内容”入队 `sync --apply`，任务 exit 0，日志显示无差异；控制台无错误。
- 当前 core：`run.mjs` + `modules/` + `src/`（通用类型）+ `workbench/` + `tools/` + `config/` + `docs/` + `common/{engine,vendor}`；无调色板枚举、引擎 props、字体/素材清单、镜头卡与项目引用。

## 2026-11-15 · 素材库独立成根（assets.roots 多根 + 相对路径）

- 素材库从 `common/assets` 迁到独立 `assets/`（gitignore）；`common/` 现在真的只剩 `engine/` 与 `vendor/`。
- `config/pipeline.json` 增加 `assets.roots`（默认 `["assets"]`），`modules/lib/config.mjs` 解析为 `cfg.assetRoots` 与 `cfg.paths.assets`；`--asset-roots a,b` 可临时覆盖。
- `modules/lib/public.mjs`：`public/assets` 改为合并目录——同名单目录只有一份时直接 junction，多份时递归合并，文件用硬链接（失败复制）；同一相对路径由前一个根优先并告警；每次重建前清理旧树；`public/music` 指向第一个含 `music/` 的根。
- `modules/lib/assets.mjs`：`scanAssetFiles/diffAssetFiles` 支持多根并报告被遮蔽的重复项；新增 `findAssetFile`。
- `tools/assets.mjs`：check 在任一根命中即通过；fetch/scan --apply 写入首根；扫描摘要新增“同名”计数。
- 创意引用改相对路径：新增 `common/engine/assets.ts` 的 `assetPath()`；`creative/shared/parts.tsx`、`ui-mock/clips.tsx`、`icon-neon` 统一走它，`icons/x.svg` 与 `assets/icons/x.svg` 都可用。
- `modules/mix/planner.mjs`：BGM/SFX 按素材根查找，EDL 音频 src 统一为 `assets/music/...` 与 `assets/sfx/...`。
- 清单 `creative/shared/assets.manifest.json` 去掉 `root` 字段；`tools/doctor.mjs`、`tools/check.mjs`、工作台 `syncPayload` 按多根报告。
- 验证：
  - `assets check` 82 条 0 缺失；`assets scan` 0 差异；`doctor` 0 警告（`public/assets` 显示 6 个合并链接）；
  - `typecheck`、`check`、`sync --check` 通过；
  - 预览 `icon-neon`（7 条）、`ui-mock`、`text-display` 渲染正常，说明图标/字体经 `assets/` 正常解析；
  - `mix --duration 6 --dry-run` 规划成功，EDL 音频为 `assets/music/aeris-afterglow-vast.mp3` 与 `assets/sfx/impact-hard.wav`；
  - 第二素材根实测：`assets-extra/icons/probe.svg` 在 `--asset-roots assets,assets-extra` 下与第一个根的 `icons/` **逐文件合并**（`public/assets/icons` 53+1 项），两个图标都能解析；`assets scan` 报新增；移除后重跑 scan 自动还原为 53 项。

## 2026-11-15 · 核心/内容边界复核

- 审计发现并修复 5 处 core 中的内容残留或失效逻辑：
  - `modules/generate/variation.mjs` 的默认调色板 `"aurora"` → 空数组 / `undefined`，由内容包 `variation.json` 提供；
  - `modules/quality/analyze.mjs` 的 `categoryOf` 去掉 `ui-mock`/`kinetic-grid`/recipe 前缀硬编码，直接用 catalog 的 `category`；
  - `modules/mix/planner.mjs` 的 overlay blend 从失效的 `recipeId` 判断改为按 `category`（particle/icon → screen），恢复粒子与霓虹叠层的正片叠底；
  - `tools/doctor.mjs` 不再抽查写死的字体/图标/地图文件名，改为从清单按 kind 抽查；
  - `run.mjs` 帮助示例、质量轴/矩阵里的 `Recipe` 概念改为 `创意工程`（`creativeByPalette`）。
- 依赖方向收紧：11 个引擎与 `creative/shared/parts.tsx` 不再从 `src/platform` 取原语，统一从 `common/engine` 取；内容只依赖 `common/engine` 与 `src/types`，core 只通过 `creative/registry.ts` 读内容。
- 配置说明：`pipeline.json` 只放可移植默认值（`assets.roots: ["assets"]`、`footage.roots: ["footage"]`）；机器相关绝对路径写 `config/local.json`（gitignore），`config/local.example.json` 已同时给出 assets 与 footage 示例。
- 验证：`typecheck`、`check`、`doctor`（0 警告）、`sync --check`、`quality --report-only`（新矩阵）通过；`scene-grid`、`text-display` 预览正常；无内容包时 `pickVariation` 返回 `palette: undefined` 而不是 `"aurora"`；mix 干跑后 overlay blend 同时出现 `screen` 与 `none`。
- 仍保留的领域词表：`modules/lib/tagger.mjs` 的平台/题材关键词（whatsapp、sim-card、cyber 等）用于实拍打标，不引用任何创意素材；如需零领域词，可移到配置或内容包。

## 2026-11-15 · 清理非必要模块（打标 / recipe 遗留）

- 实测判断：26 条实拍自动标签基本为空（只有 `actions: ["展示"]`），创意 `appliesTo.footageTags` 全为空；标签只影响裂变主题筛选（不足 5 条回退全池）与工作台展示，维护成本高于收益。
- 删除：
  - `modules/lib/tagger.mjs`；`footage.sidecars` 配置与 schema 字段；`data/human-tags.json` 支持；
  - `mix.footageTags` 过滤与 `variation.footageThemes`（含 `creative/shared/variation.json` 里的主题列表）；
  - 工作台的标签展示、标签搜索；scan 自动剥离旧条目的 `tags` / `orientation`。
- 清理失效概念：
  - catalog/EDL/类型/工作台/server 中的 `recipeId` 全部移除；`mix.maxPerRecipe` → `mix.maxPerCreative`；
  - `variation.mjs` 重写为按 `category` 驱动：去掉默认文案「连接，从这里开始」、默认引擎键 `platform-orbit`、`T06`/`T08` 分支、以及读取已删除的 `src/generated/assets.json`（图标池改读 `creative/shared/icons.json`）；
  - 质量轴/矩阵/报告里的 `Recipe` 改为 `创意工程`；
  - `modules/lib/media.mjs` 移除不再使用的 `orientation()`。
- 验证：
  - `typecheck`、`check`、`doctor`（0 警告）、`sync --check`、`node run.mjs check`、`quality --report-only` 通过；
  - `scan` 后 `data/library.json` 26 条中 0 条带 `tags`/`orientation`；
  - `mix --dry-run` 正常，overlay 的 `blend` 仍有 `screen`；`fission --with-assets --dry-run` 三个层各 1 条编译成功；
  - 工作台（端口临时 4321）：实拍页与素材弹窗正常，无标签区块、无控制台错误。
- 依赖复核：`@remotion/paths` 只被 `common/vendor/fy-implementations/craft/lineart` 使用，vendor 在 TS 工程内，依赖保留；`lucide-react` 只被内容包 `ui-mock` 使用，保留以便内容 typecheck。

## 下一会话

- 未提交改造不要回退；先 `git status`，保留本地 `creative/`、`assets/`。
- 新机器或换内容包后：`npm ci` → 放入 `creative/` 与 `assets/`（或 `assets:fetch`）→ `node run.mjs sync --apply` → `creative build`。
- 待办：素材二分类（`assets scan` 目前把一级目录映射成 kind，必要时补 `kind` 规则表）；跨盘硬链接不可用时退化为复制，需要重跑 scan/sync；工作台后续可加 `fs.watch` 提示同步。
