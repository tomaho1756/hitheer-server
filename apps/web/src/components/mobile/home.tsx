"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { LANGUAGES, loadPrefs, savePrefs } from "@/lib/languages";
import { useAuth } from "@/lib/auth-context";

import { MobileFrame } from "./frame";

const T = {
  bg: "#f6f7fa",
  surface: "#ffffff",
  surfaceAlt: "#f0f2f6",
  surfaceChip: "#eef0f4",
  text: "#18191a",
  textMuted: "#65676b",
  textFaint: "#9ca3af",
  accent: "#03C75A",
  accentDeep: "#02a949",
  accentSoft: "#e8f8ee",
};

const CARD_SHADOW =
  "0 1px 2px rgba(15,23,42,0.04), 0 4px 14px rgba(15,23,42,0.04)";

export function MobileHome() {
  const router = useRouter();
  const { user } = useAuth();
  const [speaks, setSpeaks] = useState<string[]>([]);
  const [wants, setWants] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const p = loadPrefs();
    setSpeaks(p.speaks);
    setWants(p.wants);
    setHydrated(true);
  }, []);

  const toggle = (list: string[], setList: (v: string[]) => void, code: string) => {
    setList(list.includes(code) ? list.filter((c) => c !== code) : [...list, code]);
  };

  const canMatch = speaks.length > 0 && wants.length > 0;

  const requireAuthThen = (dest: string) => {
    savePrefs({ speaks, wants });
    if (!user) {
      router.push(`/signin?next=${encodeURIComponent(dest)}`);
      return;
    }
    router.push(dest);
  };

  const startRandomMatch = () => requireAuthThen("/match");
  const startNewRoom = () => {
    const roomId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `r-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const mine = speaks[0] ?? "ko";
    const peer = wants[0] ?? "en";
    requireAuthThen(`/call/${roomId}?mine=${mine}&peer=${peer}&host=1`);
  };

  return (
    <MobileFrame title="hithere" contentBg={T.bg}>
      <div style={{ padding: "16px 16px 28px", flex: 1 }}>
        {/* Hero card with gradient + green glow */}
        <section
          style={{
            position: "relative",
            background:
              "linear-gradient(135deg, #ffffff 0%, #fafefb 100%)",
            borderRadius: 18,
            padding: 22,
            boxShadow:
              "0 1px 2px rgba(15,23,42,0.04), 0 10px 28px rgba(3,199,90,0.06)",
            overflow: "hidden",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: -50,
              right: -50,
              width: 180,
              height: 180,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(3,199,90,0.18) 0%, transparent 70%)",
              filter: "blur(20px)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "relative",
              display: "inline-block",
              padding: "3px 10px",
              background: T.accentSoft,
              color: T.accentDeep,
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: "uppercase",
              borderRadius: 999,
              marginBottom: 12,
            }}
          >
            ⚡ Realtime Translation
          </div>
          <h1
            style={{
              position: "relative",
              margin: 0,
              fontSize: 26,
              fontWeight: 900,
              letterSpacing: "-0.025em",
              lineHeight: 1.12,
              color: T.text,
            }}
          >
            모국어로 말해도
            <br />
            <span
              style={{
                background: "linear-gradient(135deg, #03C75A 0%, #5ee49b 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              그대로 통한다.
            </span>
          </h1>
          <p
            style={{
              position: "relative",
              margin: "10px 0 0",
              color: T.textMuted,
              fontSize: 13.5,
              lineHeight: 1.55,
            }}
          >
            매칭 또는 방 만들기로 바로 시작.
          </p>
        </section>

        <section style={{ marginTop: 22 }}>
          <Label>내가 할 수 있는 언어</Label>
          <ChipRow codes={speaks} toggle={(c) => toggle(speaks, setSpeaks, c)} />
        </section>
        <section style={{ marginTop: 18 }}>
          <Label>연습하고 싶은 언어</Label>
          <ChipRow codes={wants} toggle={(c) => toggle(wants, setWants, c)} />
        </section>

        <section
          style={{
            marginTop: 26,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <BigButton
            primary
            disabled={!canMatch || !hydrated}
            onClick={startRandomMatch}
            icon="🎲"
            title="랜덤 매칭"
            sub="대기 풀에서 자동으로 연결"
          />
          <BigButton
            disabled={!canMatch || !hydrated}
            onClick={startNewRoom}
            icon="🚪"
            title="방 만들기"
            sub="링크 공유 · 회의용"
          />
          {!canMatch && hydrated && (
            <p
              style={{
                color: T.textMuted,
                margin: 0,
                fontSize: 12,
                textAlign: "center",
              }}
            >
              각 줄에서 언어를 하나 이상 골라주세요.
            </p>
          )}
        </section>
      </div>
    </MobileFrame>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        margin: "0 0 9px",
        padding: "0 4px",
        fontSize: 11,
        color: T.textMuted,
        letterSpacing: 0.6,
        textTransform: "uppercase",
        fontWeight: 700,
      }}
    >
      {children}
    </h3>
  );
}

function ChipRow({ codes, toggle }: { codes: string[]; toggle: (c: string) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
      {LANGUAGES.map((l) => {
        const sel = codes.includes(l.code);
        return (
          <button
            key={l.code}
            onClick={() => toggle(l.code)}
            style={{
              padding: "8px 14px",
              background: sel ? T.accent : T.surfaceChip,
              color: sel ? "white" : T.text,
              border: "none",
              borderRadius: 999,
              cursor: "pointer",
              fontSize: 12.5,
              fontWeight: sel ? 700 : 500,
              boxShadow: sel ? `0 3px 8px ${T.accent}55` : "none",
              transition: "background 0.18s, transform 0.15s, box-shadow 0.18s",
              fontFamily: "inherit",
            }}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}

function BigButton({
  primary,
  disabled,
  onClick,
  icon,
  title,
  sub,
}: {
  primary?: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  sub: string;
}) {
  const bg = disabled
    ? T.surfaceAlt
    : primary
    ? "linear-gradient(135deg, #03C75A 0%, #04a04a 100%)"
    : T.surface;
  const color = disabled ? "#9ca3af" : primary ? "white" : T.text;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        padding: "18px 18px",
        background: bg,
        color,
        border: "none",
        borderRadius: 16,
        cursor: disabled ? "not-allowed" : "pointer",
        textAlign: "left",
        display: "flex",
        alignItems: "center",
        gap: 14,
        boxShadow: disabled
          ? "none"
          : primary
          ? "0 10px 22px rgba(3,199,90,0.35), 0 2px 6px rgba(3,199,90,0.2)"
          : CARD_SHADOW,
        fontFamily: "inherit",
        transition: "transform 0.15s",
      }}
    >
      <div
        style={{
          fontSize: 26,
          width: 44,
          height: 44,
          borderRadius: 12,
          background: primary && !disabled ? "rgba(255,255,255,0.18)" : T.accentSoft,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15.5, fontWeight: 800 }}>{title}</div>
        <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 2 }}>{sub}</div>
      </div>
      <span style={{ fontSize: 16, opacity: 0.7 }}>→</span>
    </button>
  );
}
