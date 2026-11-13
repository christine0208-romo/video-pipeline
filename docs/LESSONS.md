# LESSONS

只追加，不删除。每条写清：日期 / 现象 / 原因 / 修法 / 预防。新会话先读一遍再动手。

## 模板

```md
## YYYY-MM-DD · 一句话标题

- 现象：
- 原因：
- 修法：
- 预防：
```

## 2026-11-08 · 透明 WebM 的 ffprobe 显示 yuv420p，但 alpha 是正常的

- 现象：用 `--codec=vp9 --pixel-format=yuva420p` 渲染出来的 WebM，`ffprobe` 显示 `pix_fmt=yuv420p`，看起来像没有 alpha。
- 原因：VP9 把 alpha 存在额外块里，主流 `ffprobe` 只报主流的 yuv420p；文件元数据里有 `ALPHA_MODE=1`。
- 修法：用 libvpx 解码验证：
  ```bash
  ffmpeg -c:v libvpx-vp9 -i out.webm -vf alphaextract -frames:v 1 alpha.png
  ```
  alpha 图有黑有白即正常。或在 Remotion 里直接叠加看效果。
- 预防：不要只看 `pix_fmt`；同时看 `ALPHA_MODE` 和 alphaextract 结果。

## 2026-11-08 · 白色品牌图标在白底上消失

- 现象：Facebook / Instagram / TikTok 的 SVG 是 `fill="#FFFFFF"`，放在白色圆角块上不可见。
- 原因：Simple Icons 默认白色，深色底设计；我们用了白色 tile。
- 修法：`src/generated/parts.tsx` 里对 `WHITE_ICONS` 加 `filter: invert(1)`；图标清单在 `src/generated/assets.json`。
- 预防：新增品牌图标先看 SVG 根节点 `fill`，白色图标加入 `whiteIcons`。

## 2026-11-08 · 横屏素材随机焦点把黑边带进画面

- 现象：1920×1080 的录屏左右有黑边，混剪后画面右侧出现一条黑带。
- 原因：素材有 `crop` 元数据（有效画面 612×1080），但 planner 随机选 `focus`，`object-fit: cover` 把黑边也带进来。
- 修法：`focusFor(asset, rnd)` 对带 `crop` 的素材锁定裁剪中心；并且只允许 push/pull/still，禁止 pan，避免平移露出黑边。
- 预防：新增素材后看 `library.json` 的 `crop`；带 crop 的素材不要用自由焦点。

## 2026-11-08 · MP4 和透明 WebM 不能共用同一份 props

- 现象：第一次生成时 MP4 用了 `alpha: true` 的 props，实底视频背景变成透明/白。
- 原因：同一份 props 同时服务实底与 alpha，`GeneratedAsset` 根据 `alpha` 决定是否铺底色。
- 修法：catalog 为每个素材写 `propsMp4File`（`alpha: false`）与 `propsWebmFile`（`alpha: true`），渲染时分别使用。
- 预防：任何「同一画面、两种透明模式」的渲染，都拆 props。

## 2026-11-08 · 生成素材时长要可变，Composition 不能写死

- 现象：不同素材需要不同 `durationInFrames`，但 Root 里 `<Composition>` 的时长是静态的。
- 原因：Remotion Composition 的时长在注册时固定。
- 修法：用 `calculateMetadata` 从 props 读取 `durationInFrames`；渲染时传 `--props=<json>`。
- 预防：所有「一批同构图、不同时长」的素材，都用 `calculateMetadata`。

## 2026-11-08 · 重跑同一条 EDL 会和自己已出成片的签名冲突

- 现象：第二次跑 `mix` 时，第一条规划报「与已出成片视觉签名重复」。
- 原因：签名库里已经有上一次同名 output 的签名，规划时没有先移除自己的旧记录。
- 修法：规划前对本次要重出的每个 `mix-<seed>-<n>` 调 `removeOutputFromRegistry`；再 `addToRegistry`。
- 预防：任何「可重跑」的去重注册表，都要先撤销本次输出自己的旧记录。

## 2026-11-08 · `generate --only` 会冲掉其它 preset 的目录

- 现象：只重渲 `network-universe` 时，`catalog.json` 变成只剩 1 条。
- 原因：`buildCatalog` 只按当前 presets 构建，直接覆盖目录。
- 修法：generate 合并旧目录：保留不在本次 presets 内的条目，写回合并结果。
- 预防：局部更新命令必须声明「保留其它条目」。

## 2026-11-08 · 静止展示类素材只有 1 个场景

- 现象：26 条实拍里大部分 scene 检测只有 1 个镜头，看起来像没切分。
- 原因：产品卡片/手机录屏本身是连续单镜，scene 分数达不到阈值（0.32）。
- 修法：接受 1 个场景；混剪靠不同源区间、裁切、缩放、调色制造差异。
- 预防：不要用场景数量衡量素材质量；看 `crop` 和可用时长。

## 2026-11-08 · public 链接冲突要停下，不要覆盖

- 现象：`public/assets` 已存在且指向别处时，`ensurePublicLinks` 抛错。
- 原因：避免误删用户数据。
- 修法：人工检查链接目标，必要时先改名备份，再重跑。
- 预防：不要把 `public/` 提交进 git；它应由运行时重建。

## 2026-11-08 · 中文文件名可以进 staticFile，但不要自己编码

- 现象：`实拍-whatsapp-signup.mp4` 渲染正常，但担心路径编码。
- 原因：Remotion 4 的 `staticFile()` 自己会 `encodeURIComponent`。
- 修法：EDL 里写 `footage/<root>/实拍-....mp4` 原样路径；不要预先编码。
- 预防：看到路径里有 `%20`/`%E5` 说明被重复编码了，改用原始路径。

## 2026-11-08 · 生成片段复用超过 2 次要警告

- 现象：只有 1 个生成素材时，两条成片都用到它，画面重复。
- 原因：目录条目不足。
- 修法：`validateEdl` 对 `registry.generated` 超过 2 次给 warning；生成更多变体。
- 预防：默认至少 6 个 preset × 2 组变体；素材少时先补生成素材。

## 2026-11-08 · `ffprobe` 对 WebM 的 duration 可能是 N/A

- 现象：VP9 WebM 的 `duration` 显示 `N/A`。
- 原因：容器未写时长元数据，不影响播放与合成。
- 修法：用 `catalog.json` 里的 `duration` 字段（来自渲染配置），不要依赖 ffprobe 的 WebM duration。
- 预防：所有消费方读目录元数据，不现场 probe 生成素材。

## 2026-11-08 · 静帧用于构图检查，不用于 alpha 验证

- 现象：`renderStill` 出来的 PNG 没有 alpha（rgb24）。
- 原因：静帧不走 `yuva420p` 视频链路；它只用于看构图。
- 修法：alpha 验证用 `alphaextract` 或直接把 WebM 叠到实拍上看。
- 预防：静帧检查构图，视频检查透明与运动。

## 2026-11-08 · 抽离独立工作区时，路径与提示要一起改

- 现象：复制到独立目录后，`scan` 仍提示 `node pipeline/run.mjs generate`，`render.mjs` 仍指向旧仓库 `node_modules`。
- 原因：`REPO_ROOT`、CLI 路径、`cwd`、日志提示都还指向上游。
- 修法：
  - `config.mjs` 的 `REPO_ROOT = PIPELINE_ROOT`；
  - `render.mjs` 的 CLI 用本目录 `node_modules`，`cwd` 用本目录；
  - `run.mjs` 的 `REPO = ROOT`；
  - 全仓搜索 `pipeline/run.mjs` 并改成本地命令。
- 预防：抽离后用 `npm run doctor` + `npm run check` + 一次 `scan` 验证提示和路径。

## 2026-11-08 · public/footage 是目录，不是单个链接

- 现象：`check` 报 `public/footage 不是链接`，但扫描与渲染都正常。
- 原因：`public/footage` 是一个目录，里面每个素材根各有一个 junction；它不是单一链接。
- 修法：`check` / `doctor` 对 `public/footage` 检查「目录 + 子项为链接」，其它 public 目录检查单一链接。
- 预防：新增 public 结构时，先明确它是「单链接」还是「链接容器」。

## 2026-11-08 · catalog 里 durationInFrames 变量名不一致

- 现象：生成 recipe 条目时报 `ReferenceError: durationInFrames is not defined`。
- 原因：`makeEntry` 的参数叫 `durationFrames`，但条目对象里用了 `durationInFrames` 简写；没有同名变量。
- 修法：在函数内加 `const durationInFrames = durationFrames;`，或改成 `durationInFrames: durationFrames`。
- 预防：函数参数名和输出字段名不一致时，不要用简写，显式写 `字段: 参数`。

## 2026-11-08 · 斜切擦除在早期帧露出背景

- 现象：`transition-wipe` 在第 4 帧左下角出现黑色三角，切点可能漏边。
- 原因：旋转色块尺寸不够，progress 约 0.2 时没有完全覆盖画面。
- 修法：色块改为 300% 宽、上下各 -100%，left 从 -100% 扫到 120%。
- 预防：全屏擦除类转场至少检查 0–4 帧，不要只看中后段。

## 2026-11-08 · 叠加在转场期间被擦除盖住

- 现象：文字叠加在镜头开头就开始，前几帧被 incoming 转场遮住。
- 原因：overlay 的 `Sequence` 从镜头第 0 帧开始，没有让位给 `transitionAsset`。
- 修法：`MixVideo` 里 overlay 的 `from` 改为 `transitionAsset.dur`，并裁掉相应时长。
- 预防：同一镜头有入场转场和叠加层时，叠加层应晚于转场开始。

## 2026-11-08 · linkMusic 重复拼接扩展名

- 现象：EDL 音乐 src 变成 `audio/aeris-afterglow-vast-mp3.mp3`。
- 原因：`slugify` 用了带扩展名的 basename，后面又拼了一次 `extname`。
- 修法：`path.basename(musicPath, path.extname(musicPath))` 后再 slugify。
- 预防：生成文件名时只保留一次扩展名。

## 2026-11-08 · 短音效 loudnorm 可能失败

- 现象：小于 0.3s 的 UI 音效做 `loudnorm` 时可能报错或电平异常。
- 原因：片段太短，积分响度不可靠。
- 修法：转换时 `loudnorm` 失败则回退到 `volume=0.8`。
- 预防：短音效优先保留原始电平，或统一用更长的分析窗。

## 2026-11-08 · camera-scene 避免二次运镜

- 现象：`camera-scene` 在生成时已经带了推近/抖动，混剪又套了一次 push/pull。
- 原因：planner 对所有生成镜头都套 `baseTransform`。
- 修法：`entry.engine === "camera"` 时锁定 `motion: still`、`zoom: 1`。
- 预防：自带运镜的素材按 `engine` 或 `cameraBaked` 标记，混剪不再叠加运镜。

## 2026-11-08 · 音乐文件符号链接导致 Remotion 音频渲染 kill EPERM

- 现象：带 BGM 的 `MixVideo` 渲染到第 3–4 帧时报 `kill EPERM`；同一条 EDL 去掉音频、或只用静帧时正常。
- 原因：音乐通过 `linkMusic` 链接到 `public/audio` 的文件符号链接；Remotion 音频渲染链路读取该链接时子进程异常，清理阶段 kill 已退出进程触发 EPERM。
- 修法：库内音乐直接用 `public/music/<file>`（目录 junction）路径；外部音乐改为复制到 `public/audio`，不再使用文件符号链接。
- 预防：给 Remotion 用的音频/视频优先真实文件或目录 junction，避免文件符号链接；音频渲染失败时先用 30 帧小段 + no-audio / music-only / sfx-only 三组 props 隔离。

## 2026-11-08 · work 生成把 shared 条目清掉

- 现象：fission 后 catalog 只剩 3 条 work 素材，mix 报「生成素材 3」。
- 原因：`mergeCatalog` 的 `kept` 逻辑按 `generate.presets/recipes` 过滤 shared；work 生成只传 work 条目，shared 被当成“未选中”丢弃。
- 修法：`mergeCatalog` 增加 `preserveShared` 选项；work 生成传 `true`，保留全部 shared 条目。
- 预防：局部更新目录的 merge helper 必须声明保留范围，并用合成目录测试 shared/work 混合场景。


## 2026-11-08 · VP9 alpha 抽帧要用 libvpx-vp9

- 现象：对透明 WebM 跑 `alphaextract` 报 `Requested planes not available`，或解码成 `yuv420p` 后 alpha 全 0。
- 原因：ffmpeg 默认的 native vp9 解码器不输出 WebM 的 alpha 平面；文件元数据 `ALPHA_MODE=1` 不代表解码器会带 alpha。
- 修法：抽 alpha 时在 `-i` 前加 `-c:v libvpx-vp9`；`modules/lib/vision.mjs` 的 `sampleAlpha` 对 `.webm` 自动加。
- 预防：任何读取 transparent WebM alpha 的链路都显式指定 libvpx 解码器，并用一个已知非空素材验证 `alphaCoverage > 0`。

## 2026-11-08 · 缩放到 32px 后再判 alpha 覆盖会低估细粒子

- 现象：`particle-dust` / `particle-flow` 被质量检查标成 `empty-alpha`，但成片里能看到粒子。
- 原因：alpha 平面用 area 缩放到 32×57 后，微小粒子的峰值 alpha 被平均掉（全分辨率 max 158 / 125，缩放后 max 7 / 13）；沿用 16 的阈值会把它们全部判空。
- 修法：`quality.alphaThreshold` 改为 4（缩放后），`minAlphaCoverage` 改为 0.001，并新增 `faint-alpha`（< 0.01）只警告不拦截。
- 预防：所有在缩放图上算的阈值都要用已知素材校准；区分“空”和“淡”，不要用同一个阈值表达两件事。

## 2026-11-08 · variation 在 catalog 里是扁平 summary，不是嵌套对象

- 现象：覆盖报告里 `textAlign / rhythm / footageTheme` 全部显示 `n/a`，但 work-t3 明明有 profile。
- 原因：`work.mjs` 写入的是 `variation: variation.summary`，即扁平字段；报告按 `asset.variation.summary.textAlign` 读取，永远取不到。
- 修法：`similarity.mjs` 统一从 `asset.variation[key] ?? asset.variation.summary[key]` 读取，兼容扁平与嵌套两种历史数据。
- 预防：写读同一字段时约定清楚层级；读取侧对旧数据做兼容，写入侧不要悄悄改变形状。

## 2026-11-08 · alpha 覆盖率要和 pHash 分开采样分辨率

- 现象：work-20261121-3 的 `particle-dust` 被标 `empty-alpha`（32px 缩放下 alpha max=4），但全分辨率 alpha max=160、0.2% 像素可见。
- 原因：32px 的 area 缩放是为 pHash 服务的，会把稀疏细粒子的 alpha 平均到阈值以下；用它同时判断 alpha 覆盖会误杀极淡粒子。
- 修法：alpha 单独用 `quality.alphaSampleWidth = 96`（96×171）采样；32px 只用于 pHash。指标版本升到 2，旧 catalog 会自动重算。
- 预防：同一批原始帧可以复用，但不同指标需要各自合适的采样分辨率；不要为了省一次 ffmpeg 调用牺牲判断准确性。

## 2026-11-08 · 叙事节拍不等于剪辑点

- 现象：6 秒作品全是 5 镜头 / 4 刀，平均 1.2 秒一刀；同为 punchy 的作品镜头时长完全一致。
- 原因：planner 让每个 narrative beat 至少产生一个镜头；短片每个 beat 都短于拆分阈值，最终 beat 与 shot 一对一，切点就是 beat 比例。
- 修法：节拍只做故事窗口；按 `shotLength` 目标长度算镜头数，合并中间节拍、拆分过长镜头，并给每个作品独立的节拍抖动。
- 预防：故事结构（hook/build/proof/turn/close）与剪辑结构（cuts）要分开配置；不要让节拍数量间接决定切点数量。

## 2026-11-09 · 浏览器预览视频会锁住 out/*.mp4

- 现象：工作台里打开过成片预览后，从工作台重跑同一 seed 的 mix，Remotion 最后一步 rename `*.remotion-in-progress -> mix-*.mp4` 报 `EPERM: operation not permitted`。
- 原因：Windows 上 Chrome/Edge 的媒体播放器会持有文件句柄；Remotion 先写临时文件再重命名覆盖，目标文件被占用时 rename 失败。
- 修法：工作台在提交任务、关闭弹窗、离开成片页时释放所有 `<video>`（pause + 移除 src + load），并把预览改成 `preload="none"`；失败后清理残留的 `.remotion-in-progress`。
- 预防：任何会覆盖渲染产物的本地 UI/服务，在触发渲染前必须释放对目标文件的句柄；预览和渲染不要同时持有同一文件。

## 2026-11-09 · 只释放 video 还不够：服务端流也要销毁

- 现象：工作台页面已经释放 `<video>` 后，覆盖渲染仍然报 `EPERM`；直接命令行渲染同一文件却成功。
- 原因：工作台的 `/media` 使用 `createReadStream(...).pipe(res)`，客户端中断/切页后响应关闭，但源文件流不一定会立刻销毁，Windows 上继续持有目标文件句柄。
- 修法：`res.on("close", () => stream.destroy())`，并在流错误时销毁响应；工作台提交任务前再释放一次页面视频。
- 预防：任何“边预览边可能覆盖”的本地服务，都要同时管理浏览器端和 Node 端的文件句柄生命周期。

## 2026-11-09 · icon-morph 在半个图标上结束

- 现象：3 秒的 `icon-morph-v1-4b2453` 在末帧停在两个图标各露一半的擦除过程中，不是完整图标。
- 原因：`STEP = 0.85s` 与 3 秒不是整数倍（3 / 0.85 = 3.53），最后一个 step 只走了一半；装饰环、光斑、shine 也各自用绝对时间，首尾不闭合。
- 修法：`step = duration / icons.length`；每个 step 前 82% 完成擦除、后 18% 保持完整图标；末帧重置为 index 0 / local 0；环、光斑、shine 用 `frame / (durationInFrames - 1)` 的 cycle 驱动，保证首尾一致；预设标记 `loop: true`。
- 预防：循环素材的时长必须是动画周期的整数倍；质量检查用 `firstLastHamming` 判 `loop-mismatch`，并抽首尾帧人工复查。

## 2026-11-09 · 循环检查必须取真正的末帧

- 现象：`particle-orbs` 已改成整数周期，但 `firstLastHamming` 仍然偏高，误报 `loop-mismatch`。
- 原因：质量分析用 `fps = frames / duration` 抽帧，最后一帧落在 `duration - 1/fps` 之前，不是真正末帧；拿它和首帧比较会把“接近闭环”判成不闭合。另有一次 `tailAt = duration - 0.5/fps` 太贴边，ffmpeg 直接输出 0 帧。
- 修法：单独用 `-ss` 取尾部帧，位置取 `duration - 1.5/fps`；首帧与这个尾部帧比较。alphaEnd 同样用尾部帧。
- 预防：凡是“首尾/末帧”判断，都要明确取的是第几帧；抽帧序列的最后一帧不等于视频最后一帧。

## 2026-11-09 · 取末帧用帧号选择，不要用近末尾 seek

- 现象：`-ss duration-1.5/fps` 取到的仍是倒数第二帧，`icon-morph` 的 loop 检查误报；太靠后则输出 0 帧。
- 原因：容器时间戳、帧间隔和 seek 精度不一致；按时间去近似末帧不可靠。
- 修法：`sampleRgb/sampleAlpha` 支持 `frame` 参数，用 `select=eq(n\,lastFrame)` + `-frames:v 1` 直接取指定帧；`firstLastHamming`、`alphaEnd`、`endMotion` 都用 `durationInFrames - 1`。
- 预防：首帧、末帧、末两帧比较一律按帧号取；时间只用于抽帧序列。

## 2026-11-10 · edge-tts 语速上限与逐句时间轴

- 现象：SIM 卡文案较长，edge-tts +70% 时口播 29.2s，远超 20s 目标；+100% 时降到 24.36s。
- 原因：edge-tts 的 rate 到 +100% 左右就不再继续变快；中文长句本身字/秒有限。
- 修法：按句拆 15 段，+100% 逐句生成；缩短段间停顿到 0.02–0.25s；先出 TTS 时间轴，再按句搭分镜；片尾 CTA 纯文字不加口播。最终 27.55s，接受比 20s 略长。
- 预防：接到“20 秒左右”的长文案时，先按 5 字/秒估算口播长度；如果超目标，优先分段、压缩停顿或后期 atempo，不要直接假设 TTS 能任意加速。

## 2026-11-13 · catalog 绝对路径导致“文件全缺失”，实为旧机器路径

- 现象：catalog 92 条全部报缺少 MP4，但 `out/assets` 实际有 92 个 MP4。
- 原因：旧 catalog 保存的是旧工作区绝对路径 `D:\Files\Agent_session\video-pipeline\...`，复制到新工作区后路径失效。
- 修法：新增 `node run.mjs reindex --apply`，按当前 `out/assets` 实际文件重建路径，保留审批/退役/质量/usage 状态；0 条丢弃。
- 预防：运行产物不要依赖绝对路径做长期索引；迁移后先 `reindex` dry-run，再 check。

## 2026-11-13 · 外部素材根缺失时 manifest 保留伪历史

- 现象：素材根不存在时 library 为空，但 manifest 仍把 26 条旧素材标成 `missing`。
- 原因：scanner 在扫描后把未观测旧条目重新写回 manifest。
- 修法：缺失根按 `intentionalEmpty` 处理，manifest roots/assets 清空并记录 `missingRoots`；public/footage 同步移除 stale junction。
- 预防：空库是合法状态；不要把“未观测”写成 `missing` 历史记录。


- 现象：复制仓库后 public 的 junction 变成实体目录，out/checks 里积累下载和验收文件；直接删除可能丢用户文件或历史证据。
- 原因：public 是 Remotion 静态投影，不是资源源；运行产物、正式输出和临时检查都共用 out，缺少 artifact taxonomy。
- 修法：增加 `node run.mjs public` 报告/`--apply` 安全隔离迁移，增加 `node run.mjs cache list|clean` 且默认 dry-run；缺失外部 footage 根只报告 warning。
- 预防：复制工作区先跑 public 报告；缓存清理只允许受管目录，禁止把 data/catalog、approved 资产、实拍和成片当作缓存删除。

- 现象：+100% TTS 被用户认为太快；统一白色霓虹图标在透明背景上辨识度低；纯黑片尾 CTA 不好看。
- 原因：为压到 20s 过度加速；图标只做了发光没有保留平台识别色；片尾是生成文字卡而不是实拍。
- 修法：TTS 降到 +60%（29.756s，成片 33.56s）；图标用平台品牌色/Instagram 渐变；片尾改用压暗的 SIM 卡实拍 + CTA 文字叠加。
- 预防：节奏优先可懂度，时长目标不是硬约束；辅助图标保留品牌识别色；片尾优先使用真实产品画面而不是纯色卡。
