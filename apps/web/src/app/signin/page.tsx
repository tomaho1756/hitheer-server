"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";

import { getFirebaseAuth, googleProvider, firebaseConfigured } from "@/lib/firebase";
import {
  BrandTile,
  Divider,
  GoogleIcon,
  Input,
  NotConfigured,
  PrimaryButton,
  SecondaryButton,
} from "@/lib/auth-ui";

const ACCENT_DEEP = "#02a949";
const BORDER = "#e5e7eb";
const SURFACE = "#ffffff";
const TEXT = "#18191a";
const TEXT_MUTED = "#65676b";

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
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
          onChange={setEmail}
          disabled={!configured || busy}
        />
        <Input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={setPassword}
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
