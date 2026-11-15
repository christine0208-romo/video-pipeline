# AUDIO · 音效与 BGM 设计

声音服务于叙事，不是给画面“加满”。每条声音只做一件事：抓注意力、标记进度、确认操作、制造转折或收束。

## 1. 素材来源

| 类别 | 来源 | 许可 | 本地索引 |
|---|---|---|---|
| 音效 | Kenney UI / Interface / Impact / Digital Audio | CC0 1.0 | `shared/audio/sfx.index.json` |
| BGM | AERIS MUSIC CC0 production music | CC0 1.0 | `shared/audio/music.index.json` |
| BGM（备用） | Kevin MacLeod / incompetech | CC BY 4.0 | `shared/audio/music.index.json` |

音频文件本身在素材根 `assets/{sfx,music}`；索引属于内容包，缺失时静音，不报错。

- Kenney：https://kenney.nl/assets/ui-audio、https://kenney.nl/assets/interface-sounds、https://kenney.nl/assets/impact-sounds、https://kenney.nl/assets/digital-audio
- AERIS MUSIC：https://github.com/farmmer938-lgtm/aeris-cc0-music
- 音效已本地转为 48kHz / 16-bit WAV，并做 -18 LUFS 归一化。
- 库内 BGM 由 `resolveMusic` 输出 `music/<file>`，通过 `public/music` 目录链接读取；外部音乐复制到 `public/audio`，不使用文件符号链接。
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

- `mix.music` 支持 `null`、`"auto"`、曲目 id、文件路径，或对象。
- `mix.bpm` 为空时使用选中曲目的 BPM；没有音乐时用 90。
- `--no-music` / `--no-sfx` 用于关闭对应轨道。

## 8. 新增声音

1. 从 CC0 或明确许可的来源取文件；优先 CC0。
2. 转成 48kHz / 16-bit WAV，做 -18 LUFS 归一化。
3. 在 `shared/audio/sfx.index.json` 增加 `id / file / category / gain / duration / source / license`。
4. 用 `node tools/assets.mjs scan --apply` 登记素材，并在 `shared/CREDITS.md` 补许可与署名。
5. 若新增类别，先在 `docs/architecture/ARCHITECTURE.md` 与本文的映射表里写清用途。
