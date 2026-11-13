export function validateEdl(edl, registry, cfg) {
  const errors = [];
  const warnings = [];
  const minGap = Number(cfg.mix.minGap ?? 2);
  const maxPerAsset = Number(cfg.mix.maxPerAsset ?? 3);

  const signatures = new Set();
  const counts = {};
  const ranges = {};
  const generatedCounts = {};
  let footageCount = 0;
  let lastAssetId = null;
  let lastGeneratedId = null;

  const shots = edl.beats
    .flatMap((beat) => beat.shots)
    .sort((a, b) => a.at - b.at);

  for (const shot of shots) {
    if (shot.kind === "footage") {
      footageCount += 1;
      if (shot.assetId === lastAssetId) {
        errors.push(`相邻镜头使用同一素材：${shot.assetId}`);
      }
      lastAssetId = shot.assetId;
      lastGeneratedId = null;

      counts[shot.assetId] = (counts[shot.assetId] ?? 0) + 1;
      const start = Number(shot.in ?? 0);
      const end = start + Number(shot.dur) * Number(shot.speed ?? 1);
      ranges[shot.assetId] = ranges[shot.assetId] ?? [];
      ranges[shot.assetId].push({ start, end, relaxed: Boolean(shot.relaxed) });

      const globalRanges = registry.ranges?.[shot.assetId] ?? [];
      const overlaps = globalRanges.filter(
        (item) => Math.min(end, item.end) - Math.max(start, item.start) > 0.05,
      );
      if (overlaps.length) {
        if (shot.relaxed) {
          warnings.push(
            `素材 ${shot.assetId} 与已出成片区间重叠（已放宽）：${start.toFixed(
              2,
            )}-${end.toFixed(2)}`,
          );
        } else {
          errors.push(
            `素材 ${shot.assetId} 与已出成片区间重叠：${start.toFixed(2)}-${end.toFixed(
              2,
            )}`,
          );
        }
      }
    } else {
      if (shot.assetId === lastGeneratedId) {
        errors.push(`相邻镜头使用同一生成片段：${shot.assetId}`);
      }
      lastGeneratedId = shot.assetId;
      lastAssetId = null;
      generatedCounts[shot.assetId] = (generatedCounts[shot.assetId] ?? 0) + 1;
      const reuse = (registry.generated?.[shot.assetId] ?? 0) + 1;
      if (reuse > 2) {
        warnings.push(`生成片段 ${shot.assetId} 已在其它成片出现 ${reuse} 次`);
      }
    }

    if (shot.transitionAsset) {
      const asset = shot.transitionAsset;
      if (!asset.src) {
        errors.push(`镜头 ${shot.assetId} 的转场素材缺少 src`);
      }
      if (!(Number(asset.dur) > 0)) {
        errors.push(`镜头 ${shot.assetId} 的转场素材时长无效`);
      } else if (Number(asset.dur) > Number(shot.dur) + 0.05) {
        errors.push(
          `镜头 ${shot.assetId} 的转场素材 ${asset.dur}s 超过镜头时长 ${shot.dur}s`,
        );
      }
    }

    if (shot.signature) {
      if (signatures.has(shot.signature)) {
        errors.push(`同一成片内视觉签名重复：${shot.signature}`);
      }
      if (registry.signatures?.[shot.signature]) {
        errors.push(`与已出成片视觉签名重复：${shot.signature}`);
      }
      signatures.add(shot.signature);
    } else {
      errors.push(`镜头缺少签名：${shot.assetId}`);
    }
  }

  for (const [assetId, list] of Object.entries(ranges)) {
    const ordered = [...list].sort((a, b) => a.start - b.start);
    for (let i = 1; i < ordered.length; i += 1) {
      const gap = ordered[i].start - ordered[i - 1].end;
      if (gap < minGap - 1e-6) {
        const message = `素材 ${assetId} 源区间间隔 ${gap.toFixed(
          2,
        )}s，小于 ${minGap}s`;
        if (ordered[i].relaxed) warnings.push(message);
        else errors.push(message);
      }
    }
    if ((counts[assetId] ?? 0) > maxPerAsset) {
      errors.push(`素材 ${assetId} 使用 ${counts[assetId]} 次，超过 ${maxPerAsset}`);
    }
  }

  if (!footageCount) errors.push("成片没有实拍镜头");

  let previousEnd = 0;
  for (const shot of shots) {
    if (Math.abs(shot.at - previousEnd) > 0.04) {
      errors.push(
        `时间轴不连续：${shot.assetId} 应从 ${previousEnd.toFixed(
          2,
        )}s 开始，实际 ${shot.at.toFixed(2)}s`,
      );
    }
    previousEnd = shot.at + shot.dur;
  }
  if (Math.abs(previousEnd - edl.durationInFrames / edl.fps) > 0.06) {
    errors.push(
      `时间轴长度 ${previousEnd.toFixed(2)}s 与声明 ${(
        edl.durationInFrames / edl.fps
      ).toFixed(2)}s 不一致`,
    );
  }

  if (edl.beatFrames != null && !(Number(edl.beatFrames) > 0)) {
    errors.push(`beatFrames 无效：${edl.beatFrames}`);
  }

  if (edl.audio) {
    if (edl.audio.music && !edl.audio.music.src) {
      errors.push("音乐缺少 src");
    }
    if (Array.isArray(edl.audio.sfx)) {
      const total = edl.durationInFrames / edl.fps;
      for (const effect of edl.audio.sfx) {
        if (!effect.src) errors.push("SFX 缺少 src");
        if (!(Number(effect.at) >= 0)) {
          errors.push(`SFX 时间无效：${effect.at}`);
        }
        if (Number(effect.at) > total + 0.01) {
          errors.push(`SFX 时间超过成片长度：${effect.at}`);
        }
        if (!(Number(effect.dur) > 0)) {
          errors.push(`SFX 时长无效：${effect.dur}`);
        }
        const volume = Number(effect.volume ?? 0.4);
        if (!(volume >= 0 && volume <= 1)) {
          errors.push(`SFX 音量越界：${volume}`);
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      shots: shots.length,
      footage: footageCount,
      generated: shots.length - footageCount,
      signatures: signatures.size,
    },
  };
}

export function addToRegistry(registry, edl) {
  registry.signatures = registry.signatures ?? {};
  registry.ranges = registry.ranges ?? {};
  registry.generated = registry.generated ?? {};
  registry.outputs = registry.outputs ?? {};

  const record = { signatures: [], ranges: [], generated: [] };
  for (const shot of edl.beats.flatMap((beat) => beat.shots)) {
    if (shot.signature) {
      registry.signatures[shot.signature] = edl.id;
      record.signatures.push(shot.signature);
    }
    if (shot.kind === "footage") {
      registry.ranges[shot.assetId] = registry.ranges[shot.assetId] ?? [];
      registry.ranges[shot.assetId].push({
        start: Number(shot.in ?? 0),
        end: Number(shot.in ?? 0) + Number(shot.dur) * Number(shot.speed ?? 1),
        outputId: edl.id,
      });
      record.ranges.push({
        assetId: shot.assetId,
        start: Number(shot.in ?? 0),
        end: Number(shot.in ?? 0) + Number(shot.dur) * Number(shot.speed ?? 1),
      });
    } else {
      registry.generated[shot.assetId] =
        (registry.generated[shot.assetId] ?? 0) + 1;
      record.generated.push(shot.assetId);
    }
  }
  registry.outputs[edl.id] = record;
  return registry;
}

export function removeOutputFromRegistry(registry, outputId) {
  const record = registry.outputs?.[outputId];
  if (!record) {
    for (const [signature, id] of Object.entries(registry.signatures ?? {})) {
      if (id === outputId) delete registry.signatures[signature];
    }
    for (const [assetId, list] of Object.entries(registry.ranges ?? {})) {
      const kept = list.filter((item) => item.outputId !== outputId);
      if (kept.length) registry.ranges[assetId] = kept;
      else delete registry.ranges[assetId];
    }
    return registry;
  }

  for (const signature of record.signatures ?? []) {
    delete registry.signatures?.[signature];
  }
  for (const range of record.ranges ?? []) {
    const list = registry.ranges?.[range.assetId] ?? [];
    const kept = list.filter((item) => item.outputId !== outputId);
    if (kept.length) registry.ranges[range.assetId] = kept;
    else delete registry.ranges?.[range.assetId];
  }
  for (const generatedId of record.generated ?? []) {
    registry.generated[generatedId] = Math.max(
      0,
      (registry.generated?.[generatedId] ?? 0) - 1,
    );
  }
  delete registry.outputs[outputId];
  return registry;
}

