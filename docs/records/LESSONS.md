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

- 记账文件不得要求手改：清单、`fonts.ts`、音频索引、`shared/CREDITS.md`、注册表都要能由命令重建；系统生成却必须手改才能工作的文件视为缺陷。
- 核心不承载项目设计系统；尺寸、色板、平台避让都属于内容。
- 核心不写兜底视觉（转场/后期）；内容能表达的视觉由内容提供。
- 行为判断用通用字段（`layer / category`），不要匹配具体素材、引擎或音效 id。
- 工具缺少输入时应报告并给出下一步，而不是静默早退。
- vendor 不是必需层；只有独立升级边界或不同许可才单独成层。

## 工作台

- 浏览器预览视频会锁住 `out/*.mp4`；任务前释放视频，流关闭时销毁。
- `hidden` 属性会被自定义 `display` 覆盖。
- 工作台只监听 `127.0.0.1`，一次只跑一个任务。
