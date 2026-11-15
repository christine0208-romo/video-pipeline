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

## 2026-11-14 · hidden 属性被自定义 display 覆盖

- 现象：工作台没有运行任务时，侧栏的任务徽标仍然显示「任务 / 运行中」。
- 原因：`.job-badge { display: flex }` 是作者样式，优先级高于浏览器默认的 `[hidden] { display: none }`，`element.hidden = true` 只加属性不改计算样式。
- 修法：样式表加全局 `[hidden] { display: none !important; }`。
- 预防：任何自定义 `display` 的组件用 `hidden` 控制显隐时，必须同时提供 `[hidden]` 规则，或改用显式 class 切换。

## 2026-11-14 · 运行产物里的相对路径不能按 cwd 解析

- 现象：工作台实拍页没有缩略图，名称为空；`/api/library` 返回的 `thumbs` 全是 `[]`。
- 原因：`library.json` 的 `thumbs` 是相对 `data/` 的路径（`thumbs/xxx.jpg`），`mediaUrl` 用 `path.resolve(file)` 按服务进程 cwd 解析到仓库根，判断不在 `data/` 或 `out/` 内就返回 null；`name` 字段在 library 里根本不存在（实际是 `relPath`）。
- 修法：`listLibrary` 用 `path.join(DATA, thumb)` 解析相对缩略图，`name` 回退 `relPath`。
- 预防：索引里的相对路径必须相对其所属根目录解析；API 层显式声明相对根，不要依赖进程 cwd。

## 2026-11-14 · 宽泛的 public/ 规则把 workbench/public 也忽略了

- 现象：补回 `workbench/public/{index.html,app.js,styles.css}` 后 `git status` 不显示这些文件；初始化提交里只有 `workbench/server.mjs`，而 `npm run check` 要求前端三个文件存在。
- 原因：`.gitignore` 写的是 `public/`（没有前导斜杠），gitignore 会匹配任意层级的同名目录，`workbench/public` 被一并忽略，`git add` 静默跳过。
- 修法：根目录忽略项全部加前导 `/`（`/public/`、`/data/`、`/out/` 等），使 `workbench/public` 可以入库。
- 预防：忽略运行产物时锚定仓库根；新增必需文件后用 `git check-ignore -v <path>` 确认没有被忽略。

## 2026-11-14 · 保存创意变体时把 loader 注入的字段写回了 JSON

- 现象：工作台保存 `char-rise` 后，变体文件多出 `"file": "text-display/variants/char-rise.json"` 和一个显式的 `durationFrames`。
- 原因：服务端用 `{...variant}` 作为待写对象，而 `readCreativeProjects` 会给变体附加 `file` 等读取期字段；保存时没有剥离。
- 修法：写入前 `delete next.file / next.dir`，只持久化允许的编辑字段。
- 预防：数据层（loader）附加的只读字段与可写字段分开命名或在 API 层显式挑选，不要整对象回写。

## 2026-11-14 · textarea 没有继承 input 的深色样式

- 现象：创意页的文案输入框是白底白字，几乎看不清。
- 原因：样式只给 `input.field` / `select.field` 设了背景与文字色，`textarea` 仍是浏览器默认样式。
- 修法：补 `textarea.field` 的背景、边框、文字色与 resize。
- 预防：自定义表单控件时把 input / select / textarea 一起纳入基础样式，不要逐个补。

## 2026-11-14 · 转场故障切的末帧残留

- 现象：`transitions-glitch` 两条素材被质量检查标 `end-residue`（alphaEnd=1）。
- 原因：glitch 里的红/青 RGB 叠加层是常亮 `rgba(...,0.22)`，没有跟随 `fade` 衰减；最后一帧切片位移归零，但两层色仍可见。
- 修法：给两层 RGB 叠加加 `opacity: fade`，末帧回到透明。
- 预防：转场类引擎的每一层（底色、色散、切片、光斑）都必须乘同一个 `fade`；质量检查的 `complete: clear` 应保持开启。

## 2026-11-14 · force 重建后质量缓存没有失效

- 现象：`creative build --transitions --force` 后重渲了 glitch，但质量报告仍保留旧的 `end-residue`；本次质量分析数为 0。
- 原因：`syncCatalog` 对同 ID 条目无条件保留旧 `quality`，覆盖了本次新建条目的空质量。
- 修法：本次 `renderAsset` 返回非 0 的条目先置 `quality = null`；合并时 `null` 不继承旧值，交给 `analyzeEntries` 重算。
- 预防：任何“同 ID 覆盖重渲”的流程都要显式作废旧质量数据；缓存命中与重渲要走不同分支。

## 2026-11-15 · 清空生成产物必须连带 EDL 与签名

- 现象：只删除 catalog 与 out/assets 后，`node run.mjs check` 仍会因为旧 EDL 引用已删除素材而失败。
- 原因：EDL 与 `signatures.json` 是运行产物，但记录了已不存在的 assetId 与源区间；清理没有覆盖 `data/edl` 与 `data/works`。
- 修法：`creative reset` 把 `data/edl`、`data/works` 纳入清理范围；有 EDL 时默认拒绝 apply，`--force` 才执行。
- 预防：任何“清空生成素材”的操作都要同时处理所有引用它的派生数据；成片文件可保留，但 EDL 必须一起清。

## 2026-11-15 · 删除旧生成阶段前先迁移动词

- 现象：旧 `generate` 同时承担生成、审核、share 与 clean-work；直接删模块会让工作台资产操作失效。
- 原因：CLI 阶段名与操作语义耦合，删除生成入口时没有先给审核/分享/清理找新家。
- 修法：先把 `review.mjs` 移到 `modules/creative/`，新增 `creative review/share/clean-work/list-works`，再把工作台 `/api/action` 映射到 creative，最后删除 `generate`。
- 预防：删除一个 stage 前先列出它承担的所有动词，逐个迁移并验证工作台入口。

## 2026-11-15 · 引擎实现不能靠运行时扫目录加载

- 现象：把引擎实现放进 `creative/engines/<id>/index.tsx` 后，Remotion 渲染需要知道组件，但 CLI 扫描目录得到的组件无法直接交给静态打包器。
- 原因：Remotion 的入口是静态 import 图，动态路径不会被提前打包。
- 修法：新增 `modules/creative/registry.mjs`，扫描引擎目录后生成 `creative/registry.ts`，用静态 import 注册所有组件；`scan --write-registry` 生成、`--check-registry` 校验最新。
- 预防：任何“按目录发现组件”的机制都必须落成生成式静态注册表；新增引擎后记得重新生成。

## 2026-11-15 · 本地引擎的 preset 元数据要从 engine.json 合成

- 现象：本地引擎工程 `engine: "./engine"` 在 plan 时报“引用了未知 preset：local-smoke”。
- 原因：compile 仍从 `presets.json` 查 `preset` 元数据，而本地引擎不在那里。
- 修法：`presetMeta` 改为直接从 engine 对象合成（`supportsAlpha/description/category/loop/complete`），共享引擎与本地引擎走同一路径。
- 预防：元数据只保留一个来源（engine.json）；不要在下游继续读旧的 preset 清单。

## 2026-11-15 · 每次保存都升版会让缓存失效

- 现象：在工作台点“保存并构建”，即使只改了状态或没改内容，变体下所有素材都会换新 ID，看起来像全量新增。
- 原因：保存接口无条件把 `variant.version` +1，而版本参与了素材 ID 的 hash。
- 修法：保存时比较 `style / params / items / durationFrames / loop`，只有渲染相关内容变化才升版；状态、名称变化不升版。
- 预防：版本号必须只在影响产物的字段变化时递增；否则会不断制造孤儿素材并破坏缓存。

## 2026-11-15 · 上游快照里会混入创意实现

- 现象：`common/components/reel/v2/packs` 带着 5 套完整导演方案，看起来像框架组件，实际是具体创意实现，且在本 pipeline 中零引用。
- 原因：`common/` 是从上游工作区整目录搬来的快照，上游的演示/创意内容没有按“核心/内容”分层。
- 修法：删除未引用的 packs/Reel；把仍被 ui-mock 使用的 GeneratedClip 移入 ui-mock 引擎；core 只保留 engine/vendor/assets/shots。
- 预防：升级 common 时先跑引用检查；带具体画面、版式或叙事的文件默认视为内容，不放进 core。

## 2026-11-15 · 加入 gitignore 不会自动取消已跟踪文件

- 现象：把 `/common/assets/*` 加入 gitignore 后，字体、图标、音乐仍是 tracked 状态，`git status` 不会忽略它们。
- 原因：gitignore 只影响未跟踪文件；已跟踪文件需要先从索引移除。
- 修法：`git rm -r --cached common/assets`，再用 `git add -f` 保留 REGISTRY 与 sfx/music 索引。
- 预防：迁移“运行素材/内容目录”出仓库时，gitignore 与 `git rm --cached` 必须一起做。

## 2026-11-15 · 创意共用原语要作为一组迁移

- 现象：把 palette/parts/backdrop 单独移到 `creative/shared` 后，parts 仍引用旧的 `../platform`，palette 仍引用 `./types`，typecheck 立刻失败。
- 原因：这些文件之间有相对导入，且迁移后目录深度变了。
- 修法：按依赖组整体迁移，并统一改成 `../../src/...` 或同目录 `./...`；迁移后立即 typecheck。
- 预防：移动一组源文件时，先列出相互 import，再一次性改路径，不要逐个文件搬。

## 2026-11-15 · 注册表校验失败时 scan 不会写文件

- 现象：新增一个临时引擎后跑 `creative scan --write-registry`，随后 `creative preview` 报「未知 preset：probe-atom」，但注册表文件看起来“生成成功了”。
- 原因：本次 scan 因工程缺少变体而校验失败，流程在写注册表之前就中止；`--write-registry` 只是附加动作，不保证在校验失败时仍写入。
- 修法：先补变体让 `creative validate --strict` 通过，再重跑 `scan --write-registry`；`sync --apply` 也是先算注册表再写，校验失败同样不写。
- 预防：预览报“未知 preset”时先看 `creative scan` 的完整输出，不要只看 `tail`；新增引擎后按 validate → scan → preview 的顺序走。

## 2026-11-15 · 泛化 props 后组件类型的可赋值方向只有一边

- 现象：`EngineProps` 带 `[key: string]: unknown` 索引签名后，把 `React.FC<TextProps>` 直接赋给 `React.FC<EngineProps>` 会报错。
- 原因：函数参数是逆变的；`EngineProps` 可赋给 `TextProps`（字段都可选），反过来不行，所以 `FC<EngineProps>` 可以赋给 `FC<TextProps>`，反向必须断言。
- 修法：注册表生成时在组件赋值处加 `as React.FC<EngineProps>`；引擎内部仍用精确类型，只在边界断言一次。
- 预防：内容侧保留精确 props，core 只做透传；不要在 core 里为了“省一次断言”把引擎字段加回 `src/types.ts`。

## 2026-11-15 · 素材索引移动会被 scan 当成新增文件

- 现象：把 `common/assets/{sfx,music}/index.json` 移到 `creative/shared/audio/` 之前先跑 scan，报告“新增 music/index.json、sfx/index.json”。
- 原因：scan 按 `common/assets` 的实际文件与清单比对，索引文件当时还在落点目录里，而清单里没有它们。
- 修法：先移动文件再 scan；确实需要清理孤儿条目时用 `scan --apply --prune`，它只删清单条目、不删文件。
- 预防：迁移“清单/索引类”文件时，移动、改读取路径、再 scan 这三步放在同一轮里完成。

## 2026-11-15 · 素材库多根合并改变了 public 的链接形态

- 现象：把素材根从单目录改成多根合并后，`public/assets` 从一条 junction 变成实体目录（里面每个顶层项各是一条链接），`npm run check` 立刻报“public/assets 不是链接（疑似拷贝）”。
- 原因：校验脚本只认“public 顶层是符号链接”，而多根合并必须是实体目录 + 子项链接；Windows 上文件级符号链接需要额外权限，不适合逐文件建链。
- 修法：`check`/`doctor` 对 `public/assets` 单独判定——允许实体目录，但要求每个顶层项都是链接；顶层文件用硬链接（同盘）或复制兜底。
- 预防：改 `public/` 结构时同步改 `check` 与 `doctor` 的判定，并跑一次 `npm run check`；合并规则（同名前者优先）要写进文档与告警。
- 补充（同日）：最终实现把 `public/assets` 做成“能整目录链接就链接、冲突目录递归合并”的树，`check`/`doctor` 已放宽为“实体目录也合法”，上面“每个顶层项必须是链接”的旧判定已不适用。

## 2026-11-15 · 已删除概念的字段不能继续参与行为判断

- 现象：`planner` 的 overlay blend 仍在判断 `recipeId.startsWith("particle-")`，而新 catalog 的 `recipeId` 恒为 `null`，粒子/霓虹叠层实际上不再走 `screen`，且没有任何报错。
- 原因：功能迁移只改了数据来源，消费端保留了旧字段判断，空值让分支静默失效。
- 修法：改为按通用的 `category` 判断；并彻底移除 `recipeId` 字段与 `maxPerRecipe` 命名。
- 预防：删除或替换字段时用 `grep` 找全部消费者；迁移后用 dry-run 检查产物字段（如 EDL 的 `blend`），而不是只看命令是否成功。

## 2026-11-15 · 上下游快照整包搬运会把创意实现带进核心

- 现象：`common/vendor/fy-implementations/` 里有 camera / craft / type-cn / backgrounds 等整包上游实现，实际只有 `motion-core` 与 `remotion-kit` 的字体、时间被引用；`@remotion/paths` 也只是被其中一个未引用的线描实现使用。
- 原因：引入 vendor 时按“整目录快照”搬运，没有按实际 import 收敛。
- 修法：按引用逐项保留（canvas-engine、motion-core、remotion-kit/fonts+time），删除其余实现与随之失效的依赖，VENDOR.md 记录“保留/已移除”。
- 预防：引入上游快照后先跑一次引用扫描（按目录名 grep import），只保留被核心引用的文件；新增依赖前确认它是否只服务于 vendor 里的死代码。
- 补充（同日）：继续核对后确认 `canvas-engine/engine.js` 含项目背景、品牌印章、平台 rail 等专属绘制，属于内容，已移入 `shared/code/`；`fy-LICENSES/` 只覆盖已删除的上游部分，也已移除。

## 2026-11-15 · 工具在缺少清单时早退会让用户无法自助 bootstrap

- 现象：新机器放入素材后运行 `npm run assets:fetch`，只得到“无内容包：缺少 assets.manifest.json，跳过”；`scan --apply` 同样早退，用户无法从零建立清单。
- 原因：把“没有清单”当成“空核心”一刀切，而清单本可以从素材根自动生成。
- 修法：只有 `fetch` 需要已有清单；`scan --apply` 在无清单时创建清单；`check/list` 报告未登记文件；`sync --apply` 一并处理。
- 预防：工具对“缺少输入文件”的默认行为应是报告并给出可执行的下一步，而不是静默跳过。

## 2026-11-15 · 核心不该承载项目设计系统

- 现象：`common/engine/tokens.ts` 里放着 1080×1920、TikTok 轨道/导航/刘海避让、品牌色板、字号阶与 54px 网格，被当作“通用令牌”；`creative/shared/` 同时承担公共代码、资源清单与具体工程共用内容。
- 原因：把“被多个作品复用”误当成“属于框架”；一个项目里反复出现的数值不等于框架原语。
- 修法：拆成 core / shared / creative / assets 四层；设计令牌与平台避让作为 `shared/presets`（内容包），核心只保留 `configureEngine` 接口；公共代码、资源元数据、镜头卡统一到 `shared/`；工程可自带 `assets/`。
- 预防：判断“是否核心”看它是否与具体画幅、平台、品牌、文案绑定；绑定即内容。核心只能依赖通用接口，不能依赖某套设计令牌。

## 2026-11-15 · 核心里的兜底视觉与内容 id 映射是重复实现

- 现象：`MixVideo` 内置 flash / whip / zoom / wipe 转场与 grain / scanline / vignette 后期，`planner` 用音效 id、素材 id 前缀、引擎 id 做分支；内容包早就有转场引擎和音效索引。
- 原因：早期没有内容层时，核心先写了兜底实现；有了内容层后没有删，形成两套并行逻辑。
- 修法：删除核心内置视觉，转场只来自 `shot.transitionAsset`；音效按类别选；生成/叠加记录携带 `category`，判断只依赖 catalog 元数据；`Root` 画幅读配置。
- 预防：内容层能表达的视觉，核心不再写兜底；行为判断优先用 schema 里的通用字段（layer / category），不匹配具体 id。

## 2026-11-15 · vendor 层不是必需的中间层

- 现象：`common/vendor` 只剩 146 行自写工具（motion-core、time、fonts），却保留目录、许可文件与一整份说明，增加了“核心是否干净”的判断成本。
- 原因：把“来源可追溯”误当成“必须单独成层”。
- 修法：代码并入 `common/engine`，来源与许可写进 `common/engine/README.md` 与 `CREDITS.md`，删除 vendor。
- 预防：只有存在**独立升级边界或不同许可**的第三方代码才单独成层；自写工具直接归位。
