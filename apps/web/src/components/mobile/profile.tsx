"use client";

import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";

import { useAuth } from "@/lib/auth-context";
import { getFirebaseAuth } from "@/lib/firebase";
import { LanguageSettings } from "@/components/language-settings";

import { MobileFrame } from "./frame";

const T = {
  bg: "#f6f7fa",
  surface: "#ffffff",
  surfaceAlt: "#f0f2f6",
  text: "#18191a",
  textMuted: "#65676b",
  textFaint: "#9ca3af",
  accent: "#03C75A",
  accentDeep: "#02a949",
  accentSoft: "#e8f8ee",
  danger: "#dc2626",
};

const CARD_SHADOW =
  "0 1px 2px rgba(15,23,42,0.04), 0 4px 14px rgba(15,23,42,0.04)";

export function MobileProfile() {
  const { user, ready } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    await signOut(auth);
    router.refresh();
  };

  return (
    <MobileFrame title="프로필" contentBg={T.bg}>
      <div style={{ padding: "20px 16px 28px", flex: 1 }}>
        {!ready ? (
          <p style={{ color: T.textMuted, fontSize: 13, textAlign: "center" }}>로딩 중…</p>
        ) : !user ? (
          <SignedOutView
            onSignIn={() => router.push("/signin?next=/profile")}
            onSignUp={() => router.push("/signup?next=/profile")}
          />
        ) : (
          <>
            <ProfileCard
              name={user.displayName || user.email?.split("@")[0] || "사용자"}
              email={user.email ?? ""}
            />
            <div style={{ marginBottom: 18 }}>
              <LanguageSettings variant="card" layout="dropdown" />
            </div>
            <Section title="설정">
              <Row label="알림" hint="(준비 중)" disabled />
              <Row label="대화 기록 관리" hint="(준비 중)" disabled />
            </Section>
            <Section title="계정">
              <Row label="이메일" hint={user.email ?? "—"} disabled />
              <RowButton label="로그아웃" onClick={handleSignOut} tone="danger" />
            </Section>
            <div
              style={{
                marginTop: 28,
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
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
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: "rgba(15,23,42,0.05)",
                  color: T.textMuted,
                  textDecoration: "none",
                  fontSize: 11.5,
                  fontWeight: 600,
                }}
              >
                <GithubIcon />
                Made by{" "}
                <strong style={{ color: T.text, fontWeight: 800 }}>@tomaho1756</strong>
              </a>
              <span style={{ color: T.textFaint, fontSize: 10.5 }}>
                TOMAHO · hithere v0.1.0 (beta)
              </span>
            </div>
          </>
        )}
      </div>
    </MobileFrame>
  );
}

function SignedOutView({ onSignIn, onSignUp }: { onSignIn: () => void; onSignUp: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 16px" }}>
      <div
        style={{
          width: 64,
          height: 64,
          margin: "0 auto 16px",
          borderRadius: 20,
          background: "linear-gradient(135deg, #e8f8ee 0%, #d6f1e2 100%)",
          color: T.accentDeep,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21v-1a8 8 0 0 1 16 0v1" />
        </svg>
      </div>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.text }}>
        로그인이 필요해요
      </h2>
      <p
        style={{
          marginTop: 8,
          fontSize: 13,
          color: T.textMuted,
          lineHeight: 1.55,
        }}
      >
        대화 기록, 친구, 통화는 로그인 후 사용 가능합니다.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 22 }}>
        <button
          onClick={onSignIn}
          style={{
            padding: "13px",
            background: "linear-gradient(135deg, #03C75A 0%, #04a04a 100%)",
            color: "white",
            border: "none",
            borderRadius: 14,
            fontSize: 14.5,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 8px 22px rgba(3,199,90,0.4)",
            fontFamily: "inherit",
          }}
        >
          로그인
        </button>
        <button
          onClick={onSignUp}
          style={{
            padding: "13px",
            background: T.surface,
            color: T.text,
            border: "none",
            borderRadius: 14,
            fontSize: 14.5,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: CARD_SHADOW,
          }}
        >
          회원가입
        </button>
      </div>
    </div>
  );
}

function ProfileCard({ name, email }: { name: string; email: string }) {
  const initial = name.trim()[0]?.toUpperCase() || "?";
  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        alignItems: "center",
        padding: 18,
        background:
          "linear-gradient(135deg, #ffffff 0%, #f6fef9 100%)",
        borderRadius: 16,
        marginBottom: 18,
        boxShadow:
          "0 1px 2px rgba(15,23,42,0.04), 0 10px 24px rgba(3,199,90,0.06)",
      }}
    >
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
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: T.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </div>
        {email && (
          <div
            style={{
              marginTop: 2,
              fontSize: 12.5,
              color: T.textMuted,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {email}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h3
        style={{
          margin: "0 0 8px",
          padding: "0 4px",
          fontSize: 11,
          color: T.textMuted,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        {title}
      </h3>
      <div
        style={{
          background: T.surface,
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: CARD_SHADOW,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Row({
  label,
  hint,
  disabled,
}: {
  label: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "14px 14px",
        boxShadow: "inset 0 -1px 0 rgba(15,23,42,0.05)",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      <span style={{ fontSize: 14, color: T.text }}>{label}</span>
      <span
        style={{
          fontSize: 12,
          color: T.textMuted,
          maxWidth: 180,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {hint}
      </span>
    </div>
  );
}

function GithubIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.6-1.4-1.4-1.8-1.4-1.8-1.1-.8.1-.8.1-.8 1.3.1 1.9 1.3 1.9 1.3 1.1 1.9 3 1.4 3.7 1 .1-.8.4-1.4.8-1.7-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.3-3.2-.1-.3-.6-1.6.1-3.3 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 3 .1 3.3.8.8 1.3 1.9 1.3 3.2 0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}

function RowButton({
  label,
  onClick,
  tone = "default",
}: {
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "14px 14px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontSize: 14,
        color: tone === "danger" ? T.danger : T.text,
        fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}
