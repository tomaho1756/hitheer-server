"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
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

const BORDER = "#e5e7eb";
const SURFACE = "#ffffff";
const TEXT = "#18191a";
const TEXT_MUTED = "#65676b";
const ACCENT_DEEP = "#02a949";

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpForm />
    </Suspense>
  );
}

function SignUpForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/";
  const [displayName, setDisplayName] = useState("");
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
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateProfile(cred.user, { displayName });
      }
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
          회원가입
        </h1>
      </div>

      {!configured && <NotConfigured />}

      <form onSubmit={onSubmit} style={{ marginTop: 22 }}>
        <Input
          type="text"
          placeholder="표시 이름 (선택)"
          value={displayName}
          onChange={setDisplayName}
          disabled={!configured || busy}
        />
        <Input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={setEmail}
          disabled={!configured || busy}
        />
        <Input
          type="password"
          placeholder="비밀번호 (6자 이상)"
          value={password}
          onChange={setPassword}
          disabled={!configured || busy}
        />
        <PrimaryButton
          type="submit"
          disabled={!configured || busy || !email || password.length < 6}
        >
          {busy ? "가입 중…" : "가입하기"}
        </PrimaryButton>
      </form>

      <Divider />

      <SecondaryButton onClick={onGoogle} disabled={!configured || busy}>
        <GoogleIcon /> Google 계정으로 가입
      </SecondaryButton>

      {error && (
        <p style={{ color: "#dc2626", fontSize: 12.5, marginTop: 12 }}>{error}</p>
      )}

      <p style={{ marginTop: 18, fontSize: 13, color: TEXT_MUTED, textAlign: "center" }}>
        이미 계정이 있으세요?{" "}
        <Link
          href={`/signin${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
          style={{ color: ACCENT_DEEP, textDecoration: "none", fontWeight: 600 }}
        >
          로그인
        </Link>
      </p>
    </main>
  );
}
