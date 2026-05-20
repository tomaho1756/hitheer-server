"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "firebase/auth";

import { useAuth } from "./auth-context";
import { getFirebaseAuth } from "./firebase";

const ACCENT = "#03C75A";
const ACCENT_DEEP = "#02a949";
const ACCENT_SOFT = "#e8f8ee";
const BORDER = "#e5e7eb";
const SURFACE = "#ffffff";
const TEXT = "#18191a";
const TEXT_MUTED = "#65676b";

function MenuLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        display: "block",
        padding: "8px 10px",
        fontSize: 12.5,
        color: TEXT,
        textDecoration: "none",
        borderRadius: 6,
        fontWeight: 500,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = ACCENT_SOFT)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </Link>
  );
}

export function AccountPill({ returnTo = "/" }: { returnTo?: string }) {
  const { user, ready, configured } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  if (!ready) return <span style={{ width: 90, height: 30 }} />;

  if (!configured) {
    return (
      <span
        style={{
          fontSize: 11,
          color: "#92400e",
          background: "#fef3c7",
          padding: "5px 9px",
          borderRadius: 999,
          border: "1px solid #fcd34d",
        }}
        title="Firebase 미설정"
      >
        guest
      </span>
    );
  }

  if (!user) {
    return (
      <div style={{ display: "flex", gap: 6 }}>
        <Link
          href={`/signin?next=${encodeURIComponent(returnTo)}`}
          style={{
            fontSize: 12,
            color: TEXT,
            padding: "5px 11px",
            border: `1px solid ${BORDER}`,
            borderRadius: 999,
            textDecoration: "none",
            background: SURFACE,
            fontWeight: 500,
          }}
        >
          로그인
        </Link>
        <Link
          href={`/signup?next=${encodeURIComponent(returnTo)}`}
          style={{
            fontSize: 12,
            color: "white",
            padding: "5px 11px",
            border: `1px solid ${ACCENT}`,
            borderRadius: 999,
            textDecoration: "none",
            background: ACCENT,
            fontWeight: 600,
            boxShadow: `0 2px 6px ${ACCENT}55`,
          }}
        >
          회원가입
        </Link>
      </div>
    );
  }

  const label =
    user.displayName || user.email?.split("@")[0] || user.uid.slice(0, 6);
  const initial = (user.displayName || user.email || "?").trim()[0]?.toUpperCase() || "?";

  const handleSignOut = async () => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    await signOut(auth);
    setMenuOpen(false);
    router.refresh();
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setMenuOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "4px 11px 4px 4px",
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 999,
          cursor: "pointer",
          fontSize: 12.5,
          color: TEXT,
          fontWeight: 500,
        }}
      >
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: ACCENT_SOFT,
            color: ACCENT_DEEP,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
          }}
        >
          {initial}
        </span>
        <span style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
      </button>

      {menuOpen && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 40,
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 6px)",
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              padding: 4,
              zIndex: 50,
              boxShadow: "0 6px 18px rgba(15, 23, 42, 0.1)",
              minWidth: 180,
            }}
          >
            <div style={{ padding: "8px 10px 6px", fontSize: 11, color: TEXT_MUTED }}>
              {user.email}
            </div>
            <MenuLink href="/profile" onClick={() => setMenuOpen(false)}>
              프로필
            </MenuLink>
            <MenuLink href="/history" onClick={() => setMenuOpen(false)}>
              대화 기록
            </MenuLink>
            <MenuLink href="/friends" onClick={() => setMenuOpen(false)}>
              친구
            </MenuLink>
            <MenuLink href="/pricing" onClick={() => setMenuOpen(false)}>
              요금제
            </MenuLink>
            <div style={{ height: 1, background: BORDER, margin: "4px 6px" }} />
            <button
              onClick={handleSignOut}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "8px 10px",
                fontSize: 12.5,
                color: "#dc2626",
                background: "transparent",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              로그아웃
            </button>
          </div>
        </>
      )}
    </div>
  );
}
