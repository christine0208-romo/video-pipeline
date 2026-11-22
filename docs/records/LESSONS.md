# LESSONS · 当前有效的坑

> 这里只放仍然适用的规则，便于新会话快速读完。完整现象/原因/修法细节在
> [archive/LESSONS-HISTORY.md](../archive/LESSONS-HISTORY.md)，排查历史问题时再搜索，不默认通读。

## 渲染与编码

- 透明 WebM 的 `ffprobe` 显示 `yuv420p` 是正常的，alpha 看 `ALPHA_MODE`。
- VP9 alpha 抽帧必须用 `libvpx-vp9`，否则 alpha 全黑。
- alpha 覆盖率与 pHash 的采样分辨率要分开；缩到 32px 会低估细粒子。
- `ffprobe` 对 WebM 的 duration 可能是 N/A，按帧数换算。
- 静帧只用于构图检查，不能验证 alpha。
- MP4 与透明 WebM 必须使用各自的 props 文件。
- 生成素材时长可变，不要在 Composition 写死 `durationInFrames`。
- 重跑同一条 EDL 会与已出成片签名冲突；先清签名或换 seed。

## 路径与文件

- `public/` 链接冲突要停下，不覆盖用户数据。
- `public/footage` 是目录，不是单个链接。
- 中文文件名可进 `staticFile`，不要预先 `encodeURIComponent`。
- 运行产物里的相对路径按仓库根解析，不要按 cwd。
- gitignore 规则要锚定仓库根；`public/` 会误伤 `workbench/public/`。
- 加入 `.gitignore` 不会取消已跟踪文件，需要 `git rm --cached`。
- 素材索引/清单移动会被 scan 当成新增；先移动文件，再 scan。

## 混剪与规划

- camera 系素材在混剪里不要再套运镜（`motion = still`）。
- 叙事节拍不等于剪辑点；`beats[].shots[]` 可为空，排查看 `shot.at/dur`。
- 素材不足时去重会降级并标 `relaxed`。
- 目标镜头长度是近似值；节拍边界、最短镜头、转场拆分会拉动实际时长。

## 创意工程

- 每次保存都升版会让缓存全部失效；只在 `style/params/items/durationFrames/loop` 变化时升版。
- 注册表校验失败时 scan 不会写文件；预览报“未知 preset”先看完整 scan 输出。
- 引擎 props 泛化后，`FC<具体类型>` 不能直接赋给 `FC<EngineProps>`；在注册表边界断言一次。
- `--force` 重建要清质量缓存，否则旧质量标记跟随新文件。
- 本地引擎的 preset 元数据从 `engine.json` 合成，不要另建注册表。
- 公共代码只放被 2+ 工程复用的部分；单工程代码留在工程目录。

## 边界

- 新增文件先给“四问”：职责、替代方案、优缺点、结论；能用现有文件/配置/依赖解决就不新建。
- 版本号由用户宣布稳定点；开发期只递增 `0.0.x`，不擅自升 `0.1.0`。
- 记账文件不得要求手改：清单、`fonts.ts`、音频索引、`shared/CREDITS.md`、注册表都要能由命令重建；系统生成却必须手改才能工作的文件视为缺陷。
- 核心不承载项目设计系统；尺寸、色板、平台避让都属于内容。
- 核心不写兜底视觉（转场/后期）；内容能表达的视觉由内容提供。
- 行为判断用通用字段（`layer / category`），不要匹配具体素材、引擎或音效 id。
- 工具缺少输入时应报告并给出下一步，而不是静默早退。
- vendor 不是必需层；只有独立升级边界或不同许可才单独成层。

## 工作台

- 工作台界面文案（任务表单字段、枚举标签与提示）集中在 `config/workbench.json`；`app.js` 只按 group/key 读取，不写死中文名与提示。
- 素材 kind 入库时归一：`icons → icon`、`fonts → font`；CREDITS 与工作台按归一后的 kind 分组。
- 市场 provider 只提供目录；导入必须复用 `assets add`，许可/来源随导入写入清单，并自动更新 CREDITS。
- 市场来源定义属于本地内容，放 `config/local.json`；核心只保留 `config/pipeline.json` 的 `market.defaults`。
- 样张点击只做预览；导入必须显式确认并显示目标路径；已导入按清单路径判断，避免重复。
- 市场的发现入口优先用来源自身的类别目录（搜索只是补充），不要靠人工推荐位兜底。
- 资源移除必须自动取消清单/音频索引登记，并同步 `fonts.ts` 与 CREDITS；删除文件与仅取消登记要分开。
- 来源配置只放协议与地址（type / baseUrl / catalogUrl）；类别、许可等从来源目录读取，不写进配置或界面代码。
- 网络 provider 必须有超时与本地缓存；搜索失败不能阻断本地资源管理。
- 深色界面必须有预览底色切换（深/浅/棋盘），否则黑色或透明素材看不清。
- 原生 `<audio controls>` 进度条太短，资源试听用自定义长进度条播放器。
- 布局用固定侧栏 + 主区域滚动（app-shell），不要把 sticky 元素放进只有一行的网格区域。
- 窄屏侧栏改 sticky 时要给固定高度；`height: auto` 在横向 flex 下会塌缩，顶栏需按该高度偏移。
- 工具任务必须走白名单：工作台调用 `tools/assets.mjs` 或 `run.mjs shared` 时，脚本与参数要固定或校验，禁止把用户输入直接拼成命令；以 `-` 开头的参数值一律拒绝。
- 浏览器预览视频会锁住 `out/*.mp4`；任务前释放视频，流关闭时销毁。
- `hidden` 属性会被自定义 `display` 覆盖。
- 工作台只监听 `127.0.0.1`，一次只跑一个任务。
