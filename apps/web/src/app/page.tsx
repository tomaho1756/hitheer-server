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
const PAGE_BG = "#f7f8fa";

export default function HomePage() {
  return (
    <div style={{ background: PAGE_BG, minHeight: "100vh" }}>
      <NavBar />
      <Hero />
      <Features />
      <HowItWorks />
      <MatchSection />
      <Footer />
    </div>
  );
}

function NavBar() {
  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(255, 255, 255, 0.85)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "12px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
            color: TEXT,
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: ACCENT,
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 16,
              boxShadow: `0 2px 6px ${ACCENT}55`,
            }}
          >
            h
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.3 }}>hithere</span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <a
            href="#features"
            style={{ color: TEXT_MUTED, fontSize: 13, textDecoration: "none", fontWeight: 500 }}
          >
            기능
          </a>
          <a
            href="#how"
            style={{ color: TEXT_MUTED, fontSize: 13, textDecoration: "none", fontWeight: 500 }}
          >
            사용법
          </a>
          <Link
            href="/history"
            style={{ color: TEXT_MUTED, fontSize: 13, textDecoration: "none", fontWeight: 500 }}
          >
            기록
          </Link>
          <AccountPill returnTo="/" />
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section
      style={{
        padding: "80px 24px 60px",
        textAlign: "center",
        maxWidth: 920,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 12px",
          background: ACCENT_SOFT,
          color: ACCENT_DEEP,
          borderRadius: 999,
          fontSize: 11.5,
          fontWeight: 700,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          marginBottom: 22,
        }}
      >
        ⚡ Powered by OpenAI Realtime
      </div>
      <h1
        style={{
          margin: 0,
          fontSize: 52,
          fontWeight: 800,
          letterSpacing: -1.5,
          lineHeight: 1.1,
          color: TEXT,
        }}
      >
        실시간 번역되는<br />
        <span style={{ color: ACCENT }}>영상 통화</span>
      </h1>
      <p
        style={{
          marginTop: 18,
          fontSize: 17,
          color: TEXT_MUTED,
          lineHeight: 1.55,
          maxWidth: 540,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        전 세계 누구와도 모국어 그대로 대화하세요. 말하는 즉시 상대방 언어로 번역돼서 자막으로
        뜨고, 그대로 대화 기록에 저장돼요.
      </p>
      <div
        style={{
          marginTop: 30,
          display: "flex",
          gap: 10,
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <a
          href="#match"
          style={{
            padding: "12px 26px",
            background: ACCENT,
            color: "white",
            border: `1px solid ${ACCENT}`,
            borderRadius: 999,
            fontSize: 14.5,
            fontWeight: 700,
            textDecoration: "none",
            boxShadow: `0 4px 14px ${ACCENT}50`,
          }}
        >
          지금 시작하기
        </a>
        <a
          href="#features"
          style={{
            padding: "12px 22px",
            background: SURFACE,
            color: TEXT,
            border: `1px solid ${BORDER}`,
            borderRadius: 999,
            fontSize: 14.5,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          기능 살펴보기
        </a>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    {
      icon: "🌐",
      title: "실시간 번역",
      desc: "OpenAI Realtime API로 말하는 동시에 번역. 자막이 토큰 단위로 흘러내려요.",
    },
    {
      icon: "🎬",
      title: "P2P 영상 통화",
      desc: "WebRTC로 직접 연결. 서버를 경유하지 않아 지연이 낮고 사적인 대화가 보장돼요.",
    },
    {
      icon: "📝",
      title: "대화 기록",
      desc: "원문 + 번역 모두 자동 저장. 나중에 다시 보면서 복습할 수 있어요.",
    },
  ];
  return (
    <section
      id="features"
      style={{ padding: "60px 24px", maxWidth: 1000, margin: "0 auto" }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 28,
          fontWeight: 800,
          textAlign: "center",
          letterSpacing: -0.6,
          color: TEXT,
        }}
      >
        뭐가 다른가요?
      </h2>
      <div
        style={{
          marginTop: 36,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
        }}
      >
        {items.map((it) => (
          <div
            key={it.title}
            style={{
              padding: 24,
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: 14,
              boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
            }}
          >
            <div style={{ fontSize: 30, marginBottom: 8 }}>{it.icon}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 6 }}>
              {it.title}
            </div>
            <div style={{ fontSize: 13.5, color: TEXT_MUTED, lineHeight: 1.55 }}>{it.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "1", title: "언어 선택", desc: "사용 가능한 언어와 연습할 언어를 골라요." },
    { n: "2", title: "매칭 또는 방 만들기", desc: "랜덤 매칭으로 빠르게, 또는 링크 공유로 친구 초대." },
    { n: "3", title: "대화 시작", desc: "마이크/카메라 확인 후 입장. 자막이 실시간으로 흘러요." },
  ];
  return (
    <section
      id="how"
      style={{
        background: SURFACE,
        borderTop: `1px solid ${BORDER}`,
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      <div style={{ padding: "60px 24px", maxWidth: 1000, margin: "0 auto" }}>
        <h2
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 800,
            textAlign: "center",
            letterSpacing: -0.6,
            color: TEXT,
          }}
        >
          사용법은 간단해요
        </h2>
        <div
          style={{
            marginTop: 36,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 18,
          }}
        >
          {steps.map((s) => (
            <div key={s.n} style={{ textAlign: "center", padding: "0 8px" }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  margin: "0 auto 12px",
                  borderRadius: "50%",
                  background: ACCENT,
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 18,
                  boxShadow: `0 4px 10px ${ACCENT}50`,
                }}
              >
                {s.n}
              </div>
              <div style={{ fontSize: 15.5, fontWeight: 700, color: TEXT, marginBottom: 6 }}>
                {s.title}
              </div>
              <div style={{ fontSize: 13, color: TEXT_MUTED, lineHeight: 1.55 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MatchSection() {
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
    <section id="match" style={{ padding: "60px 24px", maxWidth: 720, margin: "0 auto" }}>
      <div
        style={{
          padding: 30,
          background: SURFACE,
          borderRadius: 18,
          border: `1px solid ${BORDER}`,
          boxShadow: "0 6px 22px rgba(15,23,42,0.07), 0 1px 3px rgba(15,23,42,0.04)",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: -0.4,
            color: TEXT,
          }}
        >
          지금 시작해보기
        </h2>
        <p style={{ color: TEXT_MUTED, marginTop: 6, fontSize: 13.5, lineHeight: 1.5 }}>
          언어를 고르고 매칭 또는 방 만들기를 선택하세요.
        </p>

        <LangSection
          title="내가 할 수 있는 언어"
          codes={speaks}
          toggle={(c) => toggle(speaks, setSpeaks, c)}
        />
        <LangSection
          title="연습하고 싶은 언어"
          codes={wants}
          toggle={(c) => toggle(wants, setWants, c)}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 24 }}>
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
          <p style={{ color: TEXT_MUTED, marginTop: 10, fontSize: 12, textAlign: "center" }}>
            각 줄에서 언어를 하나 이상 선택하면 활성화됩니다.
          </p>
        )}
      </div>
    </section>
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
      <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 2 }}>{subtitle}</div>
    </button>
  );
}

function LangSection({
  title,
  codes,
  toggle,
}: {
  title: string;
  codes: string[];
  toggle: (code: string) => void;
}) {
  return (
    <section style={{ marginTop: 20 }}>
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

function Footer() {
  return (
    <footer
      style={{
        borderTop: `1px solid ${BORDER}`,
        padding: "30px 24px",
        marginTop: 60,
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: ACCENT,
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            h
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>hithere</span>
        </div>
        <div style={{ fontSize: 12, color: TEXT_MUTED }}>
          © 2026 hithere — 실시간 번역 영상 통화
        </div>
      </div>
    </footer>
  );
}
