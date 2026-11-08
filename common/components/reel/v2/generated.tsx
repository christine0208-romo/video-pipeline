import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Check, MessageSquare, Phone as PhoneIcon, ShieldAlert, X } from "lucide-react";
import { clamp01, springAt } from "../../../engine";
import type { GeneratedClipId } from "./types";

const GEN = {
  bg: "#070B12",
  bg2: "#0E1724",
  panel: "#111B2A",
  text: "#F4F7FB",
  text2: "#A7B4C6",
  line: "rgba(255,255,255,0.14)",
  accent: "#3D8BFF",
  warn: "#FF5A4E",
  ok: "#35C48A",
};

const PhoneFrame: React.FC<{ children: React.ReactNode; t: number }> = ({ children, t }) => {
  const p = springAt(Math.max(0, t - 0.05), { stiffness: 160, damping: 20 });
  return (
    <AbsoluteFill style={{ background: GEN.bg2, alignItems: "center", justifyContent: "center" }}>
      <AbsoluteFill
        style={{
          background: "radial-gradient(60% 50% at 50% 35%, rgba(61,139,255,0.18), transparent 70%)",
        }}
      />
      <div
        style={{
          position: "relative",
          width: 560,
          height: 1180,
          borderRadius: 64,
          border: "10px solid #1B2534",
          background: GEN.panel,
          overflow: "hidden",
          transform: `translateY(${(1 - p) * 40}px) scale(${0.94 + 0.06 * p})`,
          opacity: Math.min(1, p),
          boxShadow: "0 40px 100px rgba(0,0,0,0.55)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: 180,
            height: 34,
            background: "#0A0F18",
            borderBottomLeftRadius: 20,
            borderBottomRightRadius: 20,
            zIndex: 2,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 54,
            right: 22,
            zIndex: 3,
            fontFamily: '"JetBrains Mono"',
            fontSize: 14,
            color: GEN.text2,
            border: `1px solid ${GEN.line}`,
            borderRadius: 4,
            padding: "3px 6px",
          }}
        >
          示意
        </div>
        {children}
      </div>
    </AbsoluteFill>
  );
};

const PlatformIconClip: React.FC<{ props?: Record<string, unknown> }> = ({ props }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const icon = String(props?.icon ?? "");
  const platform = String(props?.platform ?? "");
  const p = springAt(Math.max(0, t), { stiffness: 120, damping: 14 });
  const ring = (t % 1.6) / 1.6;
  return (
    <AbsoluteFill style={{ background: "#080D15", alignItems: "center", justifyContent: "center" }}>
      <AbsoluteFill
        style={{
          background: "radial-gradient(50% 40% at 50% 45%, rgba(61,139,255,0.22), transparent 72%)",
        }}
      />
      <div
        style={{
          position: "relative",
          width: 320,
          height: 320,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 320 + ring * 120,
            height: 320 + ring * 120,
            borderRadius: "50%",
            border: `2px solid rgba(61,139,255,${0.4 * (1 - ring)})`,
          }}
        />
        <div
          style={{
            width: 260,
            height: 260,
            borderRadius: 66,
            background: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${0.8 + 0.2 * p}) rotate(${Math.sin(t * 1.2) * 2}deg)`,
            boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
          }}
        >
          {icon ? (
            <Img
              src={staticFile(icon)}
              style={{ width: 156, height: 156, objectFit: "contain" }}
            />
          ) : null}
        </div>
      </div>
      <div
        style={{
          marginTop: 48,
          fontFamily: '"Noto Sans SC"',
          fontWeight: 900,
          fontSize: 64,
          color: GEN.text,
          opacity: Math.min(1, p),
        }}
      >
        {platform}
      </div>
    </AbsoluteFill>
  );
};

const GateClip: React.FC<{ props?: Record<string, unknown> }> = ({ props }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const platform = String(props?.platform ?? "平台");
  const title = String(props?.title ?? "创建账号");
  const body = String(props?.body ?? "注册前需要验证手机号");
  const fail = props?.state === "fail";
  return (
    <PhoneFrame t={t}>
      <div style={{ padding: "96px 44px 40px", color: GEN.text, fontFamily: '"Noto Sans SC"' }}>
        <div style={{ fontSize: 26, color: GEN.text2, fontFamily: '"JetBrains Mono"' }}>
          {platform}
        </div>
        <div style={{ marginTop: 18, fontSize: 58, fontWeight: 900 }}>{title}</div>
        <div
          style={{
            marginTop: 42,
            padding: "22px 24px",
            borderRadius: 18,
            border: `1px solid ${GEN.line}`,
            background: "rgba(255,255,255,0.04)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 26, color: GEN.text2 }}>手机号</span>
          <span style={{ fontFamily: '"JetBrains Mono"', fontSize: 26, color: GEN.accent }}>
            +1 ••• ••• ••••
          </span>
        </div>
        <div
          style={{
            marginTop: 18,
            padding: "18px 20px",
            borderRadius: 14,
            border: `1px solid ${fail ? GEN.warn : GEN.line}`,
            background: fail ? "rgba(255,90,78,0.10)" : "rgba(255,255,255,0.03)",
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}
        >
          <ShieldAlert size={26} color={fail ? GEN.warn : GEN.text2} />
          <span style={{ fontSize: 22, lineHeight: 1.35, color: fail ? GEN.warn : GEN.text2 }}>
            {body}
          </span>
        </div>
        <div
          style={{
            marginTop: 28,
            height: 86,
            borderRadius: 18,
            background: GEN.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 30,
            fontWeight: 700,
          }}
        >
          发送验证码
        </div>
        <div style={{ marginTop: 26, fontSize: 20, color: GEN.text2, textAlign: "center" }}>
          号码类型会影响能否收到验证码
        </div>
      </div>
    </PhoneFrame>
  );
};

const SmsClip: React.FC<{ props?: Record<string, unknown> }> = ({ props }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const platform = String(props?.platform ?? "平台");
  const code = String(props?.code ?? "738 492");
  const missing = props?.state === "missing";
  const received = !missing && t > 0.5;
  const p = springAt(Math.max(0, t - 0.5), { stiffness: 200, damping: 16 });
  return (
    <PhoneFrame t={t}>
      <div style={{ padding: "96px 36px 40px", color: GEN.text, fontFamily: '"Noto Sans SC"' }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <MessageSquare size={30} color={GEN.accent} />
            <span style={{ fontSize: 34, fontWeight: 700 }}>信息</span>
          </div>
        </div>
        <div
          style={{
            marginTop: 28,
            padding: "24px 22px",
            borderRadius: 18,
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${GEN.line}`,
          }}
        >
          <div style={{ fontSize: 24, color: GEN.text2 }}>+1 ••• ••• ••••</div>
          <div style={{ marginTop: 12, fontSize: 24, lineHeight: 1.45, color: GEN.text }}>
            {received ? (
              <>
                【{platform}】验证码{" "}
                <b style={{ fontFamily: '"JetBrains Mono"', fontSize: 42, color: GEN.accent }}>
                  {code}
                </b>
                ，5 分钟内有效。
              </>
            ) : (
              "暂未收到验证码"
            )}
          </div>
        </div>
        {received ? (
          <div
            style={{
              marginTop: 24,
              display: "flex",
              alignItems: "center",
              gap: 12,
              color: GEN.ok,
              fontSize: 24,
              opacity: Math.min(1, p),
            }}
          >
            <Check size={28} /> 验证码已到达
          </div>
        ) : (
          <div
            style={{
              marginTop: 24,
              display: "flex",
              alignItems: "center",
              gap: 12,
              color: GEN.warn,
              fontSize: 24,
            }}
          >
            <X size={28} /> 号码可能收不到
          </div>
        )}
      </div>
    </PhoneFrame>
  );
};

const CallClip: React.FC<{ props?: Record<string, unknown> }> = ({ props }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const number = String(props?.number ?? "+1 555 010 2048");
  const connectedAt = Number(props?.connectedAt ?? 0.8);
  const connected = t >= connectedAt;
  const seconds = Math.max(0, Math.floor(t - connectedAt));
  return (
    <PhoneFrame t={t}>
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "120px 40px 60px",
          color: GEN.text,
          fontFamily: '"Noto Sans SC"',
        }}
      >
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            background: "rgba(61,139,255,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <PhoneIcon size={56} color={GEN.accent} />
        </div>
        <div style={{ marginTop: 28, fontSize: 28, color: GEN.text2 }}>
          {connected ? "已接通" : "正在呼叫"}
        </div>
        <div style={{ marginTop: 8, fontFamily: '"JetBrains Mono"', fontSize: 40, fontWeight: 700 }}>
          {number}
        </div>
        <div
          style={{
            marginTop: 10,
            fontFamily: '"JetBrains Mono"',
            fontSize: 30,
            color: connected ? GEN.ok : GEN.text2,
          }}
        >
          {connected ? `00:${String(seconds).padStart(2, "0")}` : "—"}
        </div>
        <div
          style={{
            marginTop: "auto",
            width: 96,
            height: 96,
            borderRadius: 48,
            background: connected ? GEN.ok : GEN.warn,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <PhoneIcon size={44} color="#FFFFFF" />
        </div>
      </div>
    </PhoneFrame>
  );
};

const AccountClip: React.FC<{ props?: Record<string, unknown> }> = ({ props }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const platform = String(props?.platform ?? "平台");
  const icon = String(props?.icon ?? "");
  const p = springAt(Math.max(0, t - 0.3), { stiffness: 200, damping: 16 });
  return (
    <PhoneFrame t={t}>
      <div style={{ padding: "96px 40px 40px", color: GEN.text, fontFamily: '"Noto Sans SC"' }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {icon ? (
            <Img src={staticFile(icon)} style={{ width: 64, height: 64, objectFit: "contain" }} />
          ) : null}
          <div>
            <div style={{ fontSize: 30, fontWeight: 800 }}>{platform}</div>
            <div style={{ fontSize: 20, color: GEN.text2, fontFamily: '"JetBrains Mono"' }}>
              账号已登录
            </div>
          </div>
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: GEN.ok,
              opacity: Math.min(1, p),
            }}
          >
            <Check size={30} />
            <span style={{ fontSize: 22 }}>正常</span>
          </div>
        </div>
        <div
          style={{
            marginTop: 36,
            padding: "24px",
            borderRadius: 18,
            border: `1px solid ${GEN.line}`,
            background: "rgba(255,255,255,0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, color: GEN.text2 }}>
            <span>号码</span>
            <span style={{ fontFamily: '"JetBrains Mono"', color: GEN.text }}>+1 ••• ••• ••••</span>
          </div>
          <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", fontSize: 22, color: GEN.text2 }}>
            <span>短信</span>
            <span style={{ color: GEN.ok }}>可达</span>
          </div>
          <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", fontSize: 22, color: GEN.text2 }}>
            <span>状态</span>
            <span style={{ color: GEN.ok }}>正常</span>
          </div>
        </div>
        <div
          style={{
            marginTop: 28,
            height: 86,
            borderRadius: 18,
            background: "rgba(53,196,138,0.14)",
            border: `1px solid ${GEN.ok}55`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: GEN.ok,
            fontSize: 28,
            fontWeight: 700,
            opacity: Math.min(1, p),
          }}
        >
          账号可用
        </div>
      </div>
    </PhoneFrame>
  );
};

export const GeneratedClip: React.FC<{
  id: GeneratedClipId;
  dur: number;
  props?: Record<string, unknown>;
}> = ({ id, props }) => {
  switch (id) {
    case "platform-icon":
      return <PlatformIconClip props={props} />;
    case "gate":
      return <GateClip props={props} />;
    case "sms":
      return <SmsClip props={props} />;
    case "call":
      return <CallClip props={props} />;
    case "account":
      return <AccountClip props={props} />;
    default:
      return null;
  }
};
