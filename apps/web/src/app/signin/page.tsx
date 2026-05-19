"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";

import { getFirebaseAuth, googleProvider, firebaseConfigured } from "@/lib/firebase";

const ACCENT = "#03C75A";
const ACCENT_DEEP = "#02a949";
const BORDER = "#e5e7eb";
const SURFACE = "#ffffff";
const SURFACE_ALT = "#f1f3f5";
const TEXT = "#18191a";
const TEXT_MUTED = "#65676b";

export default function SignInPage() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const configured = firebaseConfigured();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!configured) return;
    const auth = getFirebaseAuth();
    if (!auth) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async () => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      router.push(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main
      style={{
        maxWidth: 420,
        margin: "10vh auto",
        padding: 30,
        background: SURFACE,
        borderRadius: 16,
        border: `1px solid ${BORDER}`,
        boxShadow: "0 6px 22px rgba(15, 23, 42, 0.07)",
      }}
    >
      <Link href="/" style={{ color: TEXT_MUTED, fontSize: 13, textDecoration: "none" }}>
        ← Home
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
        <BrandTile />
        <h1 style={{ margin: 0, fontSize: 22, color: TEXT, fontWeight: 700, letterSpacing: -0.3 }}>
          로그인
        </h1>
      </div>

      {!configured && <NotConfigured />}

      <form onSubmit={onSubmit} style={{ marginTop: 22 }}>
        <Input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(v) => setEmail(v)}
          disabled={!configured || busy}
        />
        <Input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(v) => setPassword(v)}
          disabled={!configured || busy}
        />
        <PrimaryButton disabled={!configured || busy || !email || !password} type="submit">
          {busy ? "로그인 중…" : "로그인"}
        </PrimaryButton>
      </form>

      <Divider />

      <SecondaryButton onClick={onGoogle} disabled={!configured || busy}>
        <GoogleIcon /> Google 계정으로 계속하기
      </SecondaryButton>

      {error && (
        <p style={{ color: "#dc2626", fontSize: 12.5, marginTop: 12 }}>{error}</p>
      )}

      <p style={{ marginTop: 18, fontSize: 13, color: TEXT_MUTED, textAlign: "center" }}>
        계정이 없으세요?{" "}
        <Link
          href={`/signup${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
          style={{ color: ACCENT_DEEP, textDecoration: "none", fontWeight: 600 }}
        >
          회원가입
        </Link>
      </p>
    </main>
  );
}

export function Input({
  type,
  placeholder,
  value,
  onChange,
  disabled,
}: {
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      autoComplete={
        type === "password" ? "current-password" : type === "email" ? "email" : "off"
      }
      style={{
        display: "block",
        width: "100%",
        padding: "11px 13px",
        marginBottom: 10,
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        fontSize: 14,
        color: TEXT,
        boxSizing: "border-box",
        outline: "none",
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = ACCENT)}
      onBlur={(e) => (e.currentTarget.style.borderColor = BORDER)}
    />
  );
}

export function PrimaryButton({
  children,
  disabled,
  onClick,
  type,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "submit" | "button";
}) {
  return (
    <button
      type={type ?? "button"}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        padding: "12px 14px",
        background: disabled ? SURFACE_ALT : ACCENT,
        color: disabled ? "#9ca3af" : "white",
        border: `1px solid ${disabled ? BORDER : ACCENT}`,
        borderRadius: 10,
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 14,
        fontWeight: 700,
        boxShadow: disabled ? "none" : `0 4px 10px ${ACCENT}50`,
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = ACCENT_DEEP;
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.background = ACCENT;
      }}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        padding: "11px 14px",
        background: SURFACE,
        color: TEXT,
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 13.5,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function Divider() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        margin: "16px 0",
        color: TEXT_MUTED,
        fontSize: 11,
      }}
    >
      <span style={{ flex: 1, height: 1, background: BORDER }} />
      <span>또는</span>
      <span style={{ flex: 1, height: 1, background: BORDER }} />
    </div>
  );
}

export function NotConfigured() {
  return (
    <div
      style={{
        marginTop: 16,
        padding: 12,
        background: "#fef3c7",
        border: "1px solid #fcd34d",
        borderRadius: 8,
        fontSize: 12.5,
        color: "#78350f",
      }}
    >
      <strong>Firebase 설정 필요</strong>: <code>apps/web/.env.local</code> 에{" "}
      <code>NEXT_PUBLIC_FIREBASE_*</code> 값을 채워주세요. (Firebase 콘솔 → 프로젝트 설정 →
      웹 앱 config)
    </div>
  );
}

export function BrandTile() {
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: ACCENT,
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: 19,
        boxShadow: `0 3px 8px ${ACCENT}55`,
      }}
    >
      h
    </div>
  );
}

export function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34 6.1 29.3 4 24 4c-7.7 0-14.3 4.3-17.7 10.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.3 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.4-4.3 5.8l6.2 5.2c-.4.4 6.8-5 6.8-15 0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
