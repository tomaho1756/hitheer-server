"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";

import { MobileProfile } from "@/components/mobile/profile";
import { LanguageSettings } from "@/components/language-settings";
import { useAuth } from "@/lib/auth-context";
import { getFirebaseAuth } from "@/lib/firebase";

const ACCENT = "#03C75A";
const SURFACE = "#ffffff";
const TEXT = "#18191a";
const TEXT_MUTED = "#65676b";
const CARD_SHADOW =
  "0 1px 2px rgba(15,23,42,0.04), 0 6px 22px rgba(15,23,42,0.06)";

export default function ProfilePage() {
  return (
    <>
      <div className="app-mobile-only">
        <MobileProfile />
      </div>
      <div className="app-desktop-only">
        <DesktopProfile />
      </div>
    </>
  );
}

function DesktopProfile() {
  const { user, ready } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    await signOut(auth);
    router.refresh();
  };

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "8vh auto",
        padding: "0 24px 40px",
      }}
    >
      <header style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/" style={{ color: TEXT_MUTED, fontSize: 13, textDecoration: "none" }}>
          ← 홈으로
        </Link>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: TEXT, letterSpacing: -0.3 }}>
          프로필
        </h1>
        <span style={{ width: 60 }} />
      </header>

      {!ready ? (
        <p style={{ textAlign: "center", color: TEXT_MUTED, fontSize: 13 }}>로딩 중…</p>
      ) : !user ? (
        <div
          style={{
            background: SURFACE,
            borderRadius: 16,
            padding: 40,
            textAlign: "center",
            boxShadow: CARD_SHADOW,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: TEXT }}>로그인이 필요해요</h2>
          <p style={{ marginTop: 8, color: TEXT_MUTED, fontSize: 13.5 }}>
            언어 선호도, 대화 기록은 로그인 후 사용 가능합니다.
          </p>
          <div style={{ marginTop: 22, display: "inline-flex", gap: 8 }}>
            <Link
              href="/signin?next=/profile"
              style={{
                padding: "10px 22px",
                background: "linear-gradient(135deg, #03C75A 0%, #04a04a 100%)",
                color: "white",
                borderRadius: 999,
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 13.5,
                boxShadow: "0 8px 18px rgba(3,199,90,0.35)",
              }}
            >
              로그인
            </Link>
            <Link
              href="/signup?next=/profile"
              style={{
                padding: "10px 22px",
                background: "#f0f2f6",
                color: TEXT,
                borderRadius: 999,
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 13.5,
              }}
            >
              회원가입
            </Link>
          </div>
        </div>
      ) : (
        <>
          <section
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: 22,
              background: "linear-gradient(135deg, #ffffff 0%, #f6fef9 100%)",
              borderRadius: 16,
              marginBottom: 18,
              boxShadow:
                "0 1px 2px rgba(15,23,42,0.04), 0 10px 26px rgba(3,199,90,0.06)",
            }}
          >
            <Avatar
              name={user.displayName || user.email?.split("@")[0] || "사용자"}
              photo={user.photoURL ?? null}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: TEXT }}>
                {user.displayName || user.email?.split("@")[0] || "사용자"}
              </div>
              <div style={{ marginTop: 3, fontSize: 13, color: TEXT_MUTED }}>{user.email}</div>
            </div>
            <button
              onClick={handleSignOut}
              style={{
                padding: "9px 16px",
                background: "transparent",
                color: "#dc2626",
                border: "none",
                borderRadius: 999,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: "inset 0 0 0 1px rgba(220,38,38,0.18)",
              }}
            >
              로그아웃
            </button>
          </section>

          <section style={{ marginBottom: 18 }}>
            <LanguageSettings variant="card" />
          </section>

          <section
            style={{
              background: SURFACE,
              borderRadius: 14,
              padding: 18,
              boxShadow: CARD_SHADOW,
              display: "flex",
              gap: 12,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>대화 기록</div>
              <div style={{ marginTop: 2, fontSize: 12, color: TEXT_MUTED }}>
                지난 통화의 원문과 번역을 모아보기
              </div>
            </div>
            <Link
              href="/history"
              style={{
                padding: "8px 16px",
                background: "#e8f8ee",
                color: ACCENT,
                borderRadius: 999,
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 12.5,
              }}
            >
              열기
            </Link>
          </section>

          <div
            style={{
              marginTop: 28,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <a
              href="https://github.com/tomaho1756"
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 999,
                background: "rgba(15,23,42,0.05)",
                color: TEXT_MUTED,
                textDecoration: "none",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.6-1.4-1.4-1.8-1.4-1.8-1.1-.8.1-.8.1-.8 1.3.1 1.9 1.3 1.9 1.3 1.1 1.9 3 1.4 3.7 1 .1-.8.4-1.4.8-1.7-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.3-3.2-.1-.3-.6-1.6.1-3.3 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 3 .1 3.3.8.8 1.3 1.9 1.3 3.2 0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z" />
              </svg>
              Made by{" "}
              <strong style={{ color: TEXT, fontWeight: 800 }}>@tomaho1756</strong>
            </a>
            <span style={{ color: "#9ca3af", fontSize: 11 }}>
              TOMAHO · hithere v0.1.0 (beta)
            </span>
          </div>
        </>
      )}
    </main>
  );
}

function Avatar({ name, photo }: { name: string; photo: string | null }) {
  const initial = name.trim()[0]?.toUpperCase() || "?";
  if (photo) {
    return (
      <img
        src={photo}
        alt=""
        width={56}
        height={56}
        style={{ borderRadius: 28, objectFit: "cover", flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: 28,
        background: "linear-gradient(135deg, #03C75A 0%, #5ee49b 100%)",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 22,
        fontWeight: 800,
        flexShrink: 0,
        boxShadow: "0 4px 10px rgba(3,199,90,0.4)",
      }}
    >
      {initial}
    </div>
  );
}
