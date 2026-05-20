"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { doc, getFirestore, onSnapshot } from "firebase/firestore";

import { getFirebaseApp } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

const ACCENT = "#03C75A";
const SURFACE = "#ffffff";
const TEXT = "#18191a";
const TEXT_MUTED = "#65676b";

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={null}>
      <BillingSuccessInner />
    </Suspense>
  );
}

function BillingSuccessInner() {
  const router = useRouter();
  const search = useSearchParams();
  const { user, ready } = useAuth();
  const [plan, setPlan] = useState<string | null>(null);
  const [waited, setWaited] = useState(0);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/signin?next=/billing/success");
      return;
    }
    const app = getFirebaseApp();
    if (!app) return;
    const db = getFirestore(app);
    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data();
      if (data?.plan) setPlan(String(data.plan));
    });
    const tick = setInterval(() => setWaited((s) => s + 1), 1000);
    return () => {
      unsub();
      clearInterval(tick);
    };
  }, [ready, user, router]);

  // Once we see a paid plan, force-refresh the ID token so custom claims
  // (set by the webhook) propagate to the client immediately.
  useEffect(() => {
    if (!plan || plan === "free") return;
    user?.getIdToken(true).catch(() => undefined);
  }, [plan, user]);

  const settled = plan && plan !== "free";

  return (
    <main
      style={{
        maxWidth: 520,
        margin: "12vh auto",
        padding: "32px 24px",
        background: SURFACE,
        borderRadius: 18,
        boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 12px 36px rgba(15,23,42,0.08)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          margin: "0 auto 16px",
          borderRadius: 32,
          background: settled
            ? "linear-gradient(135deg, #03C75A 0%, #5ee49b 100%)"
            : "#eef0f4",
          color: settled ? "white" : TEXT_MUTED,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
          fontWeight: 800,
          boxShadow: settled ? "0 8px 22px rgba(3,199,90,0.4)" : "none",
        }}
      >
        {settled ? "✓" : "…"}
      </div>
      <h1
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 900,
          letterSpacing: -0.3,
          color: TEXT,
        }}
      >
        {settled ? "구독이 활성화됐어요" : "결제 확인 중…"}
      </h1>
      <p
        style={{
          marginTop: 10,
          color: TEXT_MUTED,
          fontSize: 13.5,
          lineHeight: 1.55,
        }}
      >
        {settled ? (
          <>
            현재 플랜: <strong style={{ color: TEXT }}>{plan}</strong>
            <br />
            지금부터 늘어난 일일 번역 한도가 적용됩니다.
          </>
        ) : (
          <>
            Stripe에서 webhook으로 알려주면 자동으로 반영돼요.
            <br />
            보통 몇 초 안에 끝나요. ({waited}s)
          </>
        )}
      </p>
      <div style={{ marginTop: 22, display: "inline-flex", gap: 8 }}>
        <Link
          href="/"
          style={{
            padding: "10px 22px",
            background: settled ? ACCENT : "#f0f2f6",
            color: settled ? "white" : TEXT,
            borderRadius: 999,
            textDecoration: "none",
            fontWeight: 700,
            fontSize: 13.5,
            boxShadow: settled ? "0 8px 22px rgba(3,199,90,0.35)" : "none",
          }}
        >
          홈으로
        </Link>
        <Link
          href="/profile"
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
          프로필
        </Link>
      </div>
      <p
        style={{
          marginTop: 16,
          fontSize: 11,
          color: "#9ca3af",
        }}
      >
        Session: {search.get("session_id")?.slice(0, 24) || "—"}
      </p>
    </main>
  );
}
