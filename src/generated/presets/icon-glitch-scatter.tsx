import React from "react";
import { AbsoluteFill, staticFile, useCurrentFrame } from "remotion";
import { SOCIAL_ICONS } from "../../assets";
import { keyedRandom } from "../../platform";
import { paletteOf } from "../palette";
import type { PresetProps } from "../types";

const LAYOUT_SEED = 20261109;
const TILE = 182;

const SLOTS = [
  { x: 17, y: 17, d: 0.72 },
  { x: 50, y: 12, d: 1.16 },
  { x: 83, y: 20, d: 0.82 },
  { x: 12, y: 45, d: 0.96 },
  { x: 50, y: 40, d: 1.34 },
  { x: 88, y: 49, d: 0.9 },
  { x: 20, y: 72, d: 0.74 },
  { x: 54, y: 74, d: 1.08 },
  { x: 82, y: 80, d: 0.66 },
];

const SLOT_ORDER = [0, 2, 3, 4, 6, 8, 1, 5, 7];

type GlitchProps = PresetProps & {
  glitchIndex?: number;
  glitchLabel?: string;
  glitchStart?: number;
  intensity?: number;
};

type Brand = { color?: string; gradient?: string; glow?: string };

const BRAND: Record<string, Brand> = {
  "whatsapp.svg": { color: "#25D366" },
  "telegram.svg": { color: "#26A5E4" },
  "wechat.svg": { color: "#07C160" },
  "line.svg": { color: "#06C755" },
  "discord.svg": { color: "#5865F2" },
  "instagram.svg": {
    gradient:
      "linear-gradient(135deg, #FEDA75, #FA7E1E, #D62976, #962FBF, #4F5BD5)",
    glow: "#E1306C",
  },
  "facebook.svg": { color: "#1877F2" },
  "x-twitter.svg": { color: "#FFFFFF" },
  "openai.svg": { color: "#10A37F" },
};

const brandFor = (icon: string): Brand =>
  BRAND[icon.split("/").pop() ?? ""] ?? { color: "#00F0FF" };

const BrandGlyph: React.FC<{
  icon: string;
  brand: Brand;
  style?: React.CSSProperties;
}> = ({ icon, brand, style }) => (
  <div
    style={{
      position: "absolute",
      left: "17%",
      top: "17%",
      width: "66%",
      height: "66%",
      background: brand.gradient ?? brand.color ?? "#00F0FF",
      maskImage: `url(${staticFile(icon)})`,
      WebkitMaskImage: `url(${staticFile(icon)})`,
      maskSize: "contain",
      WebkitMaskSize: "contain",
      maskRepeat: "no-repeat",
      WebkitMaskRepeat: "no-repeat",
      maskPosition: "center",
      WebkitMaskPosition: "center",
      filter: `drop-shadow(0 0 7px ${brand.glow ?? brand.color ?? "#00F0FF"}) drop-shadow(0 0 18px ${brand.glow ?? brand.color ?? "#00F0FF"})`,
      ...style,
    }}
  />
);

export const IconGlitchScatter: React.FC<GlitchProps> = ({
  alpha = true,
  seed = 701,
  icons = SOCIAL_ICONS.slice(0, 6),
  labels,
  palette = "cyber",
  glitchIndex = -1,
  glitchLabel,
  glitchStart = 30,
  intensity = 1,
}) => {
  const frame = useCurrentFrame();
  const p = paletteOf(palette);
  const isBase = glitchIndex < 0;

  const local = frame - glitchStart;
  const burst = !isBase && local >= 0 && local < 20;
  const echo =
    !isBase &&
    ((local >= 26 && local < 30) || (local >= 38 && local < 42));
  const envelope = Math.sin(
    Math.min(1, Math.max(0, local / 20)) * Math.PI,
  );
  const amount = burst
    ? (0.7 + 0.3 * envelope) * intensity
    : echo
      ? 0.26 * intensity
      : 0;

  const targetLabel =
    glitchLabel ?? (glitchIndex >= 0 ? labels?.[glitchIndex] : undefined);
  const targetBrand =
    glitchIndex >= 0 ? brandFor(icons[glitchIndex]) : null;
  const targetColor = targetBrand?.glow ?? targetBrand?.color ?? p.accent;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: alpha ? "transparent" : p.bg,
        overflow: "hidden",
        fontFamily: '"Noto Sans SC"',
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(45% 34% at 50% 42%, ${p.glow}, transparent 72%)`,
          opacity: 0.9,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: "-30%",
          right: "-30%",
          bottom: "-8%",
          height: "58%",
          backgroundImage: `linear-gradient(${p.accent}20 1px, transparent 1px), linear-gradient(90deg, ${p.accent}20 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
          transform: "perspective(520px) rotateX(62deg)",
          transformOrigin: "bottom center",
          opacity: 0.38,
          maskImage: "linear-gradient(transparent, black 60%)",
          WebkitMaskImage: "linear-gradient(transparent, black 60%)",
        }}
      />

      {Array.from({ length: 16 }, (_, i) => {
        const x = keyedRandom(LAYOUT_SEED, `spec-x-${i}`) * 100;
        const y = keyedRandom(LAYOUT_SEED, `spec-y-${i}`) * 100;
        const size = 1.5 + keyedRandom(LAYOUT_SEED, `spec-s-${i}`) * 3;
        const color = i % 3 === 0 ? p.accent2 : p.accent;
        return (
          <div
            key={`spec-${i}`}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: size,
              height: size,
              borderRadius: "50%",
              background: color,
              opacity: 0.18 + keyedRandom(LAYOUT_SEED, `spec-o-${i}`) * 0.4,
              boxShadow: `0 0 ${size * 4}px ${color}`,
              mixBlendMode: "screen",
            }}
          />
        );
      })}

      {icons.map((icon, i) => {
        const slot = SLOTS[SLOT_ORDER[i % SLOT_ORDER.length]];
        const depth =
          slot.d + (keyedRandom(LAYOUT_SEED, `d-${i}`) - 0.5) * 0.16;
        const x = slot.x + (keyedRandom(LAYOUT_SEED, `x-${i}`) - 0.5) * 5;
        const y = slot.y + (keyedRandom(LAYOUT_SEED, `y-${i}`) - 0.5) * 5;
        const rotate = (keyedRandom(LAYOUT_SEED, `r-${i}`) - 0.5) * 16;
        const scale = 0.6 + depth * 0.38;
        const blur = Math.max(0, (1.25 - depth) * 2.6);
        const opacity = 0.65 + depth * 0.3;
        const isGlitch = i === glitchIndex;
        const glitchAmount = isGlitch ? amount : 0;
        const jitterX =
          (keyedRandom(seed, `gx-${frame}`) - 0.5) * 38 * glitchAmount;
        const jitterY =
          (keyedRandom(seed, `gy-${frame}`) - 0.5) * 18 * glitchAmount;
        const glow = isGlitch ? 1 + glitchAmount * 1.4 : 1;
        const label = labels?.[i];
        const brand = brandFor(icon);
        const brandColor = brand.glow ?? brand.color ?? p.accent;

        return (
          <div
            key={`${icon}-${i}`}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: TILE,
              height: TILE,
              zIndex: Math.round(depth * 100),
              opacity,
              filter: `blur(${blur}px)`,
              transform: `translate(-50%, -50%) perspective(1100px) translateZ(${(depth - 1) * 90}px) rotate(${rotate + glitchAmount * (keyedRandom(seed, `gr-${frame}`) - 0.5) * 16}deg) scale(${scale * (1 + glitchAmount * 0.08)})`,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: TILE * 0.2,
                background: "rgba(3, 8, 18, 0.76)",
                border: `1.5px solid ${
                  isGlitch ? brandColor : `${brandColor}55`
                }`,
                boxShadow: `0 0 ${isGlitch ? 28 : 14}px ${brandColor}${
                  isGlitch ? "88" : "33"
                }, inset 0 0 22px ${brandColor}22`,
                overflow: "hidden",
                transform: `translate(${jitterX}px, ${jitterY}px)`,
              }}
            >
              <BrandGlyph
                icon={icon}
                brand={brand}
                style={{
                  filter: `drop-shadow(0 0 ${6 * glow}px ${brandColor}) drop-shadow(0 0 ${18 * glow}px ${brandColor})`,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: `repeating-linear-gradient(0deg, ${brandColor}22 0 1px, transparent 1px 4px)`,
                  opacity: 0.22 + glitchAmount * 0.45,
                  mixBlendMode: "screen",
                }}
              />
              {isGlitch && glitchAmount > 0.03 ? (
                <>
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: `linear-gradient(180deg, ${p.accent}66, transparent 42%, ${p.accent2}55)`,
                      opacity: 0.35 * glitchAmount,
                      mixBlendMode: "screen",
                    }}
                  />
                  <BrandGlyph
                    icon={icon}
                    brand={{ color: "#00F0FF" }}
                    style={{
                      transform: `translate(${-20 * glitchAmount}px, ${-3 * glitchAmount}px)`,
                      opacity: 0.8 * glitchAmount,
                      mixBlendMode: "screen",
                    }}
                  />
                  <BrandGlyph
                    icon={icon}
                    brand={{ color: "#FF2BD6" }}
                    style={{
                      transform: `translate(${20 * glitchAmount}px, ${3 * glitchAmount}px)`,
                      opacity: 0.7 * glitchAmount,
                      mixBlendMode: "screen",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: "-14%",
                      right: "-14%",
                      top: `${20 + keyedRandom(seed, `slice-${frame}`) * 58}%`,
                      height: 4 + glitchAmount * 14,
                      background: brandColor,
                      opacity: 0.7 * glitchAmount,
                      mixBlendMode: "screen",
                      transform: `translateX(${(keyedRandom(seed, `sx-${frame}`) - 0.5) * 34 * glitchAmount}px) skewX(${glitchAmount * 8}deg)`,
                    }}
                  />
                </>
              ) : null}
            </div>

            {isGlitch ? (
              <>
                <div
                  style={{
                    position: "absolute",
                    inset: -10,
                    borderRadius: TILE * 0.24,
                    border: `1px solid ${brandColor}66`,
                    boxShadow: `0 0 ${18 + glitchAmount * 24}px ${brandColor}55`,
                    opacity: 0.35 + glitchAmount * 0.55,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: -18 - Math.max(0, local) * 5,
                    borderRadius: TILE * 0.3,
                    border: `2px solid ${brandColor}`,
                    boxShadow: `0 0 34px ${brandColor}66`,
                    opacity: 0.65 * glitchAmount,
                  }}
                />
              </>
            ) : null}

            {label ? (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: TILE + 10,
                  textAlign: "center",
                  fontFamily: '"JetBrains Mono"',
                  fontSize: 13,
                  letterSpacing: "0.16em",
                  color: isGlitch ? brandColor : p.text2,
                  opacity: isGlitch ? 0.8 + glitchAmount * 0.2 : 0.55,
                  textShadow: `0 0 10px ${brandColor}77`,
                  transform: `translateX(${isGlitch ? jitterX * 0.4 : 0}px)`,
                }}
              >
                {label}
              </div>
            ) : null}
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: 40,
          right: 40,
          top: 42,
          display: "flex",
          justifyContent: "space-between",
          fontFamily: '"JetBrains Mono"',
          fontSize: 12,
          letterSpacing: "0.2em",
          color: p.text2,
          opacity: 0.55,
        }}
      >
        <span>NEON GRID // {isBase ? "STANDBY" : "SIGNAL"}</span>
        <span style={{ color: isBase ? p.text2 : targetColor }}>
          {isBase ? "MULTI-CHANNEL" : targetLabel?.toUpperCase() ?? "CHANNEL"}
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0 1px, transparent 1px 3px)",
          opacity: 0.28,
          mixBlendMode: "multiply",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
