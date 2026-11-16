# AUDIO · 音效与 BGM 设计

声音服务于叙事，不是给画面“加满”。每条声音只做一件事：抓注意力、标记进度、确认操作、制造转折或收束。

## 1. 素材来源

| 类别 | 来源 | 许可 | 本地索引 |
|---|---|---|---|
| 音效 | Kenney UI / Interface / Impact / Digital Audio | CC0 1.0 | `shared/audio/sfx.index.json` |
| BGM | AERIS MUSIC CC0 production music | CC0 1.0 | `shared/audio/music.index.json` |
| BGM（备用） | Kevin MacLeod / incompetech | CC BY 4.0 | `shared/audio/music.index.json` |

音频文件放在素材根 `assets/` 的任意位置；索引条目的 `file` 写**相对素材根**的路径（如 `music/x.mp3`、`custom/intro.wav`）。旧版裸文件名（`ui-tap.wav`）继续兼容。索引属于内容包，缺失时静音，不报错。

- Kenney：https://kenney.nl/assets/ui-audio、https://kenney.nl/assets/interface-sounds、https://kenney.nl/assets/impact-sounds、https://kenney.nl/assets/digital-audio
- AERIS MUSIC：https://github.com/farmmer938-lgtm/aeris-cc0-music
- 音效已本地转为 48kHz / 16-bit WAV，并做 -18 LUFS 归一化。
- 库内音频由 `resolveAudioFile(roots, kind, file)` 解析：含 `/` 的路径先按原路径、再按 `kind/原路径`；裸文件名先按 `kind/名`、再按原名。命中后输出 `assets/<相对路径>`，通过 `public/assets` 合并目录读取；仓外绝对路径才复制到 `public/audio`。
- CC BY 曲目（`Crypto`、`Floating Cities`）只在需要时使用，发布时必须保留署名。

## 2. 叙事角色 → 声音设计

| 角色 | 意图 | SFX | 音乐能量 |
|---|---|---|---|
| hook | 抓住注意力 | `impact-hard` + `sub-drop`；首切 whoosh | 0.9 |
| build | 建立信息 | 转场 whoosh；文字 tap；UI click | 1.0 |
| proof | 给证据 | confirm / click / typing / sparkle | 1.0 |
| turn | 转折 | `transition-riser`（提前 0.45s）+ glitch + impact-soft | 0.7 |
| close | 收束 | impact-soft / sub-drop；音乐淡出 | 0.55 |

## 3. 画面事件 → 声音

| 画面事件 | 声音（按类别选第一条） | 时机 |
|---|---|---|
| 任意转场原子 | `whoosh` | 镜头开始 |
| 文字叠加 | `tap` | 叠加开始（转场结束后） |
| 图标叠加 | `click` | 叠加开始（转场结束后） |
| 图形叠加 | `sparkle` | 叠加开始（转场结束后） |
| 界面示意生成镜头 | `confirm` | 镜头开始 +0.2s |
| hook 节拍 | `impact` + `sub` | 节拍点 |
| turn 节拍 | `riser` + `impact` + `sub` | riser 提前 0.45s |
| close 节拍 | `impact` + `sub` | 节拍点 |

核心只按素材类别（`category`）选音效，不引用具体音效 id；音效文件与类别由 `shared/audio/sfx.index.json` 提供。

## 4. BGM 选择

默认配置：

```json
{
  "mode": "auto",
  "mood": "calm",
  "energy": "medium",
  "volume": 0.6,
  "fadeIn": 0.8,
  "fadeOut": 1.0,
  "duckTo": 0.22
}
```

自动选曲评分：

- 时长足够（≥ 成片时长 + 3s）：+4
- CC0 许可：+3（优先于 CC BY）
- 情绪精确匹配：+3；近义匹配：+2
- 能量匹配：+3；不匹配：-1
- 包含 proof 角色：+1
- 若指定 `mix.bpm`，BPM 越接近扣分越少

当前曲库的关键曲目：

| 曲目 | BPM | 情绪 | 能量 | 适合 |
|---|---|---|---|---|
| Afterglow Vast | 84 | chill | medium | build / proof / close |
| Horizon Monolith | 112 | uplifting | high | hook / build / proof |
| Signal Lost | 96 | cinematic | medium | hook / turn |

## 5. 音乐包络与 ducking

- 淡入 0.8s，淡出 1.0s。
- 角色能量：hook 0.9 / build 1.0 / proof 1.0 / turn 0.7 / close 0.55。
- SFX 活跃时音乐 duck 到 0.22（约 -8.7 dB），SFX 结束后恢复。
- 音乐默认音量 0.6；最终建议 -16 到 -21 LUFS integrated，峰值 ≤ -1 dBTP。
- 实测源响度：Afterglow Vast -14.7 LUFS；impact-hard -22 LUFS（短音效，积分值仅供参考）。
- 实测最终成片：`mix-20261117-1` 为 -20.9 LUFS integrated，峰值 -5.97 dBFS（12s）。

## 6. 密度与避噪

- 12 秒最多约 8–12 个 SFX；30 秒最多 16 个（`mix.sfx.maxPerOutput`）。
- 同类 SFX 最小间隔 0.05s；打字机的 0.06s 连续 tap 例外。
- 不在每个镜头都放 SFX；没有新信息的切点保持干净。
- 同一帧不重复同类声音；音乐 + SFX 总峰值不超过 -1 dBTP。

## 7. 配置与命令

```json
"mix": {
  "bpm": null,
  "music": {
    "mode": "auto",
    "mood": "calm",
    "energy": "medium",
    "volume": 0.6,
    "duckTo": 0.22
  },
  "sfx": {
    "enabled": true,
    "volume": 1.4,
    "maxPerOutput": 16,
    "minGap": 0.05
  }
}
```

```bash
node run.mjs mix --duration 12 --outputs 1 --seed 20261108
node run.mjs mix --duration 12 --music auto --music-mood calm --music-energy medium
node run.mjs mix --duration 12 --no-music
node run.mjs mix --duration 12 --no-sfx
```

- `mix.music` 支持 `null`、`"auto"`、曲目 id、相对素材根的路径（`--music custom/theme.mp3`）、仓外绝对路径，或对象。
- `mix.bpm` 为空时使用选中曲目的 BPM；没有音乐时用 90。
- `--no-music` / `--no-sfx` 用于关闭对应轨道。

## 8. 新增声音

1. 从 CC0 或明确许可的来源取文件；优先 CC0。
2. 转成 48kHz / 16-bit WAV，做 -18 LUFS 归一化。
3. 用 `node tools/assets.mjs add <文件> --license <许可>` 导入，或放进素材根后运行 `node tools/assets.mjs audio scan --apply`；索引条目自动生成（`id / file / duration`）。
4. 用 `node tools/assets.mjs audio set <id> --category ... --gain ...` 补元数据。
5. 需要署名时再补 `license`/`source` 并重新生成 `shared/CREDITS.md`。
6. 若新增类别，先在 `docs/architecture/ARCHITECTURE.md` 与本文的映射表里写清用途。

## 12. 维护索引

`shared/audio/{music,sfx}.index.json` 是混剪的选曲目录，不建议手改，用命令维护：

```bash
# 新文件放进素材根任意位置（不必是 music/、sfx/）
node tools/assets.mjs audio scan --apply    # 扫描所有素材根，登记未编入索引的音频，时长用 ffprobe
node tools/assets.mjs audio set <id> --bpm 96 --mood cinematic --energy medium   # BGM 元数据
node tools/assets.mjs audio set <id> --category tap --gain 0.4                  # 音效
node tools/assets.mjs audio list
```

- 索引 `file` 写相对素材根路径；`music/`、`sfx/` 一级目录优先决定 kind，其他目录 `.wav` 视为音效、其余视为音乐；
- 旧版裸文件名（`ui-tap.wav`）继续可用，不需要迁移；
- 新 BGM 默认 `mood/energy=unknown`，不填也能用，但自动选曲会按 `config.mix.music.mood/energy` 打分，建议补上；
- 新音效默认 `category=unknown`，planner 不会主动选它，补 `category` 后才会进入对应事件；
- `license` / `source` 可选，需要署名时再补；`shared credits` 会带进 `shared/CREDITS.md`。
