"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { LANGUAGES, loadPrefs, savePrefs } from "@/lib/languages";
import { AccountPill } from "@/lib/account-pill";

const ACCENT = "#03C75A";
const ACCENT_DEEP = "#02a949";
const ACCENT_SOFT = "#e8f8ee";
const BORDER = "#e5e7eb";
const SURFACE = "#ffffff";
const SURFACE_ALT = "#f1f3f5";
const TEXT = "#18191a";
const TEXT_MUTED = "#65676b";

export default function HomePage() {
  const router = useRouter();
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

  const startRandomMatch = () => {
    savePrefs({ speaks, wants });
    router.push("/match");
  };

  const startNewRoom = () => {
    savePrefs({ speaks, wants });
    const roomId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `r-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const mine = speaks[0] ?? "ko";
    const peer = wants[0] ?? "en";
    router.push(`/call/${roomId}?mine=${mine}&peer=${peer}&host=1`);
  };

  return (
    <main
      style={{
        maxWidth: 620,
        margin: "6vh auto",
        padding: 30,
        background: SURFACE,
        borderRadius: 18,
        boxShadow: "0 6px 22px rgba(15, 23, 42, 0.07), 0 1px 3px rgba(15, 23, 42, 0.04)",
        border: `1px solid ${BORDER}`,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: ACCENT,
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 22,
              boxShadow: `0 4px 10px ${ACCENT}66`,
            }}
          >
            h
          </div>
          <h1 style={{ margin: 0, fontSize: 26, letterSpacing: -0.4, color: TEXT }}>
            hithere
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link
            href="/history"
            style={{
              color: TEXT_MUTED,
              fontSize: 12,
              textDecoration: "none",
              padding: "5px 10px",
              border: `1px solid ${BORDER}`,
              borderRadius: 999,
              background: SURFACE,
            }}
          >
            📜 기록
          </Link>
          <AccountPill returnTo="/" />
        </div>
      </header>

      <p style={{ color: TEXT_MUTED, marginTop: 8, fontSize: 14, lineHeight: 1.55 }}>
        실시간 번역되는 1:1 영상 통화 ·{" "}
        <span style={{ color: ACCENT_DEEP, fontWeight: 600 }}>
          준비된 사람과 매칭
        </span>{" "}
        하거나{" "}
        <span style={{ color: ACCENT_DEEP, fontWeight: 600 }}>방을 만들어</span> 공유하세요.
      </p>

      <Section title="내가 할 수 있는 언어" codes={speaks} toggle={(c) => toggle(speaks, setSpeaks, c)} />
      <Section title="연습하고 싶은 언어" codes={wants} toggle={(c) => toggle(wants, setWants, c)} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginTop: 26,
        }}
      >
        <ModeButton
          primary
          disabled={!canMatch || !hydrated}
          onClick={startRandomMatch}
          icon="🎲"
          title="랜덤 매칭"
          subtitle="대기 풀에서 자동 연결"
        />
        <ModeButton
          disabled={!canMatch || !hydrated}
          onClick={startNewRoom}
          icon="🚪"
          title="방 만들기"
          subtitle="링크 공유 · 회의용"
        />
      </div>

      {!canMatch && hydrated && (
        <p style={{ color: TEXT_MUTED, marginTop: 12, fontSize: 12.5, textAlign: "center" }}>
          각 줄에서 언어를 하나 이상 선택하면 활성화됩니다.
        </p>
      )}

      <details style={{ marginTop: 32, color: TEXT_MUTED }}>
        <summary style={{ cursor: "pointer", fontSize: 12 }}>dev: open a specific room</summary>
        <p style={{ fontSize: 12.5, lineHeight: 1.5 }}>
          For WebRTC debugging only. Navigate to <code>/call/&lt;room-id&gt;</code> in two tabs.
        </p>
      </details>
    </main>
  );
}

function ModeButton({
  primary,
  disabled,
  onClick,
  icon,
  title,
  subtitle,
}: {
  primary?: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  subtitle: string;
}) {
  const bg = disabled ? SURFACE_ALT : primary ? ACCENT : SURFACE;
  const color = disabled ? "#9ca3af" : primary ? "white" : TEXT;
  const border = disabled ? BORDER : primary ? ACCENT : BORDER;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "16px 18px",
        background: bg,
        color,
        border: `1px solid ${border}`,
        borderRadius: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        textAlign: "left",
        fontSize: 14,
        boxShadow: !disabled && primary ? `0 4px 14px ${ACCENT}50` : "none",
        transition: "transform 0.15s, background 0.15s",
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = "translateY(-1px)";
          if (primary) e.currentTarget.style.background = ACCENT_DEEP;
          else e.currentTarget.style.background = ACCENT_SOFT;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.background = bg;
      }}
    >
      <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
      <div
        style={{
          fontSize: 11.5,
          opacity: 0.85,
          marginTop: 2,
        }}
      >
        {subtitle}
      </div>
    </button>
  );
}

function Section({
  title,
  codes,
  toggle,
}: {
  title: string;
  codes: string[];
  toggle: (code: string) => void;
}) {
  return (
    <section style={{ marginTop: 22 }}>
      <h3
        style={{
          margin: "0 0 10px",
          fontSize: 11,
          color: TEXT_MUTED,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        {title}
      </h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {LANGUAGES.map((l) => {
          const selected = codes.includes(l.code);
          return (
            <button
              key={l.code}
              onClick={() => toggle(l.code)}
              style={{
                padding: "7px 14px",
                background: selected ? ACCENT : SURFACE,
                color: selected ? "white" : TEXT,
                border: `1px solid ${selected ? ACCENT : BORDER}`,
                borderRadius: 999,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: selected ? 600 : 500,
                transition: "all 0.15s",
                boxShadow: selected ? `0 2px 6px ${ACCENT}50` : "none",
              }}
              onMouseEnter={(e) => {
                if (!selected) {
                  e.currentTarget.style.background = ACCENT_SOFT;
                  e.currentTarget.style.borderColor = ACCENT;
                }
              }}
              onMouseLeave={(e) => {
                if (!selected) {
                  e.currentTarget.style.background = SURFACE;
                  e.currentTarget.style.borderColor = BORDER;
                }
              }}
            >
              {l.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
