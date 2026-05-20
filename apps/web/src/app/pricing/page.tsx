"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, getFirestore, onSnapshot } from "firebase/firestore";

import { useAuth } from "@/lib/auth-context";
import { getFirebaseApp } from "@/lib/firebase";
import { startCheckout, openBillingPortal, type PaidPlan } from "@/lib/billing";

const ACCENT = "#03C75A";
const ACCENT_DEEP = "#02a949";
const SURFACE = "#ffffff";
const TEXT = "#18191a";
const TEXT_MUTED = "#65676b";
const PAGE_BG = "#f8faf9";

interface TierDef {
  plan: "free" | PaidPlan;
  name: string;
  priceUsd: number | null;
  tagline: string;
  features: string[];
  highlight?: boolean;
}

const TIERS: TierDef[] = [
  {
    plan: "free",
    name: "Free",
    priceUsd: 0,
    tagline: "가볍게 써보기",
    features: [
      "1:1 영상 통화",
      "실시간 번역 자막 (8개 언어)",
      "일일 번역 30분",
      "대화 기록 자동 저장",
    ],
  },
  {
    plan: "pro",
    name: "Pro",
    priceUsd: 9.99,
    tagline: "꾸준히 쓰는 사람",
    highlight: true,
    features: [
      "Free 전체 +",
      "일일 번역 5시간",
      "통화 중 번역 ON/OFF 토글",
      "용어집 (Glossary) 지원",
      "우선 처리 — 응답 지연 ↓",
    ],
  },
  {
    plan: "professional",
    name: "Professional",
    priceUsd: 39.99,
    tagline: "프로 / 팀용",
    features: [
      "Pro 전체 +",
      "일일 번역 무제한",
      "베타 기능 — 영어 회화 레슨 모드 (예정)",
      "다대다 회의방 (예정)",
      "통화록 .md 내보내기",
    ],
  },
];

export default function PricingPage() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<TierDef["plan"]>("free");
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);

  // Live-subscribe to users/{uid}.plan so this page reflects the active
  // subscription as soon as the webhook updates Firestore.
  useEffect(() => {
    if (!user) {
      setCurrentPlan("free");
      return;
    }
    const app = getFirebaseApp();
    if (!app) return;
    const db = getFirestore(app);
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      const data = snap.data() ?? {};
      const plan = (data.plan as TierDef["plan"]) ?? "free";
      setCurrentPlan(plan);
      const sub = data.subscription as { cancelAtPeriodEnd?: boolean } | undefined;
      setCancelAtPeriodEnd(!!sub?.cancelAtPeriodEnd);
    });
    return () => unsub();
  }, [user]);

  const handleSelect = async (plan: TierDef["plan"]) => {
    setError(null);
    if (plan === "free") {
      router.push("/");
      return;
    }
    if (!ready) return;
    if (!user) {
      router.push(`/signin?next=${encodeURIComponent("/pricing")}`);
      return;
    }
    // Already subscribed to this plan → open portal instead of new checkout.
    if (currentPlan === plan) {
      try {
        setBusy(plan);
        await openBillingPortal();
      } catch (e) {
        setBusy(null);
        setError((e as Error).message);
      }
      return;
    }
    try {
      setBusy(plan);
      await startCheckout(plan);
    } catch (e) {
      setBusy(null);
      setError((e as Error).message);
    }
  };

  return (
    <main style={{ background: PAGE_BG, minHeight: "100vh", padding: "60px 20px 80px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <header style={{ textAlign: "center", marginBottom: 36 }}>
          <Link
            href="/"
            style={{
              display: "inline-block",
              marginBottom: 18,
              color: TEXT_MUTED,
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            ← 홈으로
          </Link>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(28px, 5vw, 42px)",
              fontWeight: 900,
              letterSpacing: -0.6,
              color: TEXT,
            }}
          >
            요금제
          </h1>
          <p
            style={{
              marginTop: 12,
              fontSize: 15,
              color: TEXT_MUTED,
              lineHeight: 1.55,
            }}
          >
            언제든 변경하거나 취소할 수 있어요. 결제는 Stripe로 안전하게 처리됩니다.
          </p>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 22,
            alignItems: "stretch",
          }}
        >
          {TIERS.map((t) => (
            <TierCard
              key={t.plan}
              tier={t}
              busy={busy === t.plan}
              disabled={!!busy}
              isCurrent={t.plan === currentPlan}
              cancelAtPeriodEnd={cancelAtPeriodEnd && t.plan === currentPlan}
              onSelect={() => handleSelect(t.plan)}
            />
          ))}
        </div>

        {error && (
          <p
            style={{
              marginTop: 20,
              textAlign: "center",
              color: "#dc2626",
              fontSize: 13.5,
            }}
          >
            {error}
          </p>
        )}

        {user && (
          <div style={{ marginTop: 26, textAlign: "center" }}>
            <button
              onClick={() => openBillingPortal().catch((e) => setError((e as Error).message))}
              style={{
                padding: "10px 22px",
                background: "transparent",
                color: TEXT_MUTED,
                border: "none",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.12)",
                fontFamily: "inherit",
              }}
            >
              구독 관리 (Billing Portal)
            </button>
          </div>
        )}

        <p
          style={{
            marginTop: 40,
            textAlign: "center",
            fontSize: 12,
            color: TEXT_MUTED,
          }}
        >
          결제 진행 시{" "}
          <Link href="/terms" style={{ color: ACCENT_DEEP }}>
            이용약관
          </Link>{" "}
          및{" "}
          <Link href="/privacy" style={{ color: ACCENT_DEEP }}>
            개인정보처리방침
          </Link>
          에 동의한 것으로 간주됩니다.
        </p>
      </div>
    </main>
  );
}

function TierCard({
  tier,
  busy,
  disabled,
  isCurrent,
  cancelAtPeriodEnd,
  onSelect,
}: {
  tier: TierDef;
  busy: boolean;
  disabled: boolean;
  isCurrent: boolean;
  cancelAtPeriodEnd: boolean;
  onSelect: () => void;
}) {
  const highlight = !!tier.highlight;
  return (
    <div
      style={{
        position: "relative",
        background: SURFACE,
        borderRadius: 20,
        padding: "32px 26px 28px",
        minHeight: 440,
        boxShadow: highlight
          ? "0 1px 2px rgba(3,199,90,0.1), 0 18px 48px rgba(3,199,90,0.22)"
          : "0 1px 2px rgba(15,23,42,0.04), 0 10px 28px rgba(15,23,42,0.06)",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        outline: highlight ? `2px solid ${ACCENT}` : "none",
      }}
    >
      {isCurrent && (
        <span
          style={{
            position: "absolute",
            top: -10,
            right: 22,
            padding: "3px 10px",
            background: "#18191a",
            color: "white",
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            borderRadius: 999,
            boxShadow: "0 6px 14px rgba(0,0,0,0.35)",
          }}
        >
          현재 플랜
        </span>
      )}
      {highlight && !isCurrent && (
        <span
          style={{
            position: "absolute",
            top: -10,
            left: 22,
            padding: "3px 10px",
            background: "linear-gradient(135deg, #03C75A 0%, #04a04a 100%)",
            color: "white",
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            borderRadius: 999,
            boxShadow: "0 6px 14px rgba(3,199,90,0.45)",
          }}
        >
          Most popular
        </span>
      )}
      <div>
        <div style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
          {tier.tagline}
        </div>
        <div style={{ marginTop: 4, fontSize: 22, fontWeight: 900, color: TEXT }}>
          {tier.name}
        </div>
      </div>
      <div>
        <span style={{ fontSize: 32, fontWeight: 900, letterSpacing: -0.5, color: TEXT }}>
          {tier.priceUsd && tier.priceUsd > 0 ? `$${tier.priceUsd.toFixed(2)}` : "Free"}
        </span>
        {tier.priceUsd && tier.priceUsd > 0 ? (
          <span style={{ marginLeft: 6, fontSize: 13, color: TEXT_MUTED }}>/ month</span>
        ) : null}
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {tier.features.map((f) => (
          <li key={f} style={{ display: "flex", gap: 8, fontSize: 13.5, color: TEXT, lineHeight: 1.4 }}>
            <span style={{ color: ACCENT, flexShrink: 0, marginTop: 2 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={onSelect}
        disabled={disabled}
        style={{
          marginTop: "auto",
          padding: "12px 16px",
          background:
            isCurrent
              ? "#eef0f4"
              : tier.plan === "free"
              ? "#eef0f4"
              : "linear-gradient(135deg, #03C75A 0%, #04a04a 100%)",
          color: isCurrent || tier.plan === "free" ? TEXT : "white",
          border: "none",
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 800,
          cursor: disabled ? "not-allowed" : "pointer",
          boxShadow:
            isCurrent || tier.plan === "free"
              ? "none"
              : "0 8px 22px rgba(3,199,90,0.4)",
          opacity: disabled && !busy ? 0.5 : 1,
          fontFamily: "inherit",
        }}
      >
        {busy
          ? "이동 중…"
          : isCurrent
          ? cancelAtPeriodEnd
            ? "취소 예정 · 관리"
            : tier.plan === "free"
            ? "현재 플랜"
            : "구독 관리"
          : tier.plan === "free"
          ? "그대로 쓰기"
          : "선택하기"}
      </button>
    </div>
  );
}
