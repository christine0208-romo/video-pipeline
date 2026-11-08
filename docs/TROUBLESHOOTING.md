# TROUBLESHOOTING

## 体检

先跑：

```bash
npm run doctor
```

它会检查 Node、依赖、ffmpeg/ffprobe、浏览器、配置、素材根、资源、public 链接。

## 依赖未安装 / npm install 失败

- 确认 Node >= 22：`node -v`。
- 确认在 `video-pipeline/` 目录内执行 `npm install`，不要在父目录。
- 网络受限时先配好 npm registry 或代理。
- 版本必须锁死，不要随手升级 Remotion 全家；版本不一致会导致渲染器与运行时错配。

## ffmpeg / ffprobe 不可用

- 确认 PATH：`ffmpeg -version`、`ffprobe -version`。
- 或在 `config/pipeline.json` 写绝对路径：
  ```json
  "tools": { "ffmpeg": "C:/ffmpeg/bin/ffmpeg.exe", "ffprobe": "C:/ffmpeg/bin/ffprobe.exe" }
  ```
- 或设环境变量 `FFMPEG_PATH` / `FFPROBE_PATH`。

## 找不到浏览器

- 安装 Chrome，或让 Playwright 的 `chromium_headless_shell` 存在。
- 或指定：
  ```bash
  REMOTION_BROWSER="C:/Program Files/Google/Chrome/Application/chrome.exe" node run.mjs generate
  ```
- 离线机器必须提前准备浏览器，Remotion 可能尝试下载。

## 画面出现黑边

- 看 `data/library.json` 里该素材的 `crop`。
- 带 `crop` 的素材应该锁定裁剪中心；planner 已经对 `crop` 素材禁用 pan。
- 如果素材有黑边但 `crop` 为 `null`，说明 `cropdetect` 没识别到：
  - 降低 `sceneSplit` 无关；调 `footage.cropDetect` 为 `true` 后重跑 `scan --force`；
  - 或在 `tags.json` 里手工写 `crop` 并重跑 scan（需要扩展 tagger 支持，或直接改 manifest 后重跑 mix）。
- 仍不理想时，考虑给该素材做裁切 proxy，再作为新素材导入。

## 透明 WebM 看起来没有 alpha

- `ffprobe` 显示 `yuv420p` 是正常的；看 `ALPHA_MODE=1`。
- 用 libvpx 解码验证：
  ```bash
  ffmpeg -c:v libvpx-vp9 -i out/assets/x.webm -vf alphaextract -frames:v 1 alpha.png
  ```
- 若 alpha 全白，说明渲染时背景不是透明：
  - 检查 `propsWebmFile` 是否为 `alpha: true`；
  - 检查 `GeneratedAsset` 与 preset 是否在 `alpha` 时仍铺底色；
  - 检查是否用了 `renderStill` 验证 alpha（静帧不走 alpha 链路，不能用它判断）。

## staticFile 404 / 中文路径

- `staticFile` 会自己编码；不要预先 `encodeURIComponent`。
- 检查 `public/footage/<root>/...` 链接是否存在，且指向真实 root。
- 检查 EDL 的 `src` 是否以 `footage/<rootName>/` 开头。
- 检查 Windows 路径分隔符：写进 JSON 前统一 `/`。

## 没有可用素材

- `scan` 后看 `data/library.json` 是否有 `type:"video"` 且 `duration >= 1.5`。
- 检查 `footage.roots` 是否写错；`node run.mjs scan` 会打印缺失根目录。
- 检查素材扩展名是否在 `footage.extensions`。

## 没有生成素材

- `node run.mjs generate`。
- 检查 `data/catalog.json` 与 `out/assets/`；catalog 里没有文件的条目会被 mix 跳过。
- `--only` 只补指定 preset；需要全部时跑 `generate`。

## EDL 校验失败：签名重复 / 区间重叠

- 重跑同一条 output 前，代码会先移除它自己的旧签名；如果仍冲突，说明与其它 output 冲突。
- 换 `--seed` 重新规划。
- 素材太少时：
  - 增加素材；
  - 增加生成 preset 变体；
  - 临时放宽 `mix.maxPerAsset` / `minGap`，但会在 EDL 标 `relaxed`。
- 只重置去重记录：
  ```bash
  rm data/edl/signatures.json
  ```

## 渲染很慢

- 不要并发跑多个 Remotion 渲染。
- 生成素材先 `--variants 1` 试做，确认后再加。
- 混剪先 `--dry-run` 看 EDL，再实渲。
- 分段的 `--frames` 只渲染需要检查的区间；全片最后再跑。
- 素材分辨率过高时，考虑做 1080×1920 proxy。

## public 链接冲突

- 报错说明 `public/xxx` 已存在且指向别处。
- 不要直接删除；先 `ls -l` / `Get-Item` 看目标，确认是旧链接后改名备份，再重跑。
- 代码拒绝覆盖是为了保护用户数据。

## TypeScript 报错

- `npm run typecheck`。
- 新增 JSON 时确认 `resolveJsonModule` 已开。
- 从 `common` 引用时保持原目录关系；不要改成别名。
- 第三方包类型缺失时，先看是否真的需要；不要随手加 `any` 掩盖。

## Remotion 版本不一致

- `npm ls remotion @remotion/cli`。
- 所有 `@remotion/*` 必须同一版本；不要混用。
- 升级时全家一起升级，并重跑一次 3 帧确定性测试与一条 12 秒成片。
