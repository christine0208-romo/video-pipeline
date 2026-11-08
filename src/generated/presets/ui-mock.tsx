import React from "react";
import { useVideoConfig } from "remotion";
import { GeneratedClip } from "../../platform";
import type { PresetProps } from "../types";

export const UiMock: React.FC<PresetProps> = ({
  alpha,
  clip = "sms",
  platform = "WhatsApp",
  icon = "assets/icons/whatsapp.svg",
}) => {
  const { durationInFrames, fps } = useVideoConfig();
  if (alpha) return null;
  return (
    <GeneratedClip
      id={clip}
      dur={durationInFrames / fps}
      props={{ platform, icon }}
    />
  );
};
