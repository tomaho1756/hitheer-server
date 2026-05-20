"use client";

// Shows the user's current plan + a way to manage / upgrade.
// Reads users/{uid}.plan in real-time. Used by both mobile and desktop profile.

import { useEffect, useState } from "react";
import Link from "next/link";
import { doc, getFirestore, onSnapshot } from "firebase/firestore";

import { useAuth } from "@/lib/auth-context";
import { getFirebaseApp } from "@/lib/firebase";
import { openBillingPortal } from "@/lib/billing";

const T = {
  surface: "#ffffff",
  text: "#18191a",
  textMuted: "#65676b",
  accent: "#03C75A",
  accentDeep: "#02a949",
  accentSoft: "#e8f8ee",
};

const PLAN_LABEL: Record<string, { name: string; daily: string }> = {
  free: { name: "Free", daily: "일일 번역 30분" },
  pro: { name: "Pro", daily: "일일 번역 5시간" },
  professional: { name: "Professional", daily: "일일 번역 무제한" },
};

export function PlanCard() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<string>("free");
  const [periodEnd, setPeriodEnd] = useState<number | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [portalErr, setPortalErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    const app = getFirebaseApp();
    if (!app) return;
    const db = getFirestore(app);
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      const d = snap.data() ?? {};
      setPlan(String(d.plan ?? "free"));
      const sub = d.subscription as
        | { currentPeriodEnd?: number; cancelAtPeriodEnd?: boolean }
        | undefined;
      setPeriodEnd(sub?.currentPeriodEnd ?? null);
      setCancelAtPeriodEnd(!!sub?.cancelAtPeriodEnd);
    });
    return () => unsub();
  }, [user]);

  const info = PLAN_LABEL[plan] ?? PLAN_LABEL.free;
  const isPaid = plan !== "free";

  return (
    <div
      style={{
        background: isPaid
          ? "linear-gradient(135deg, #ffffff 0%, #f6fef9 100%)"
          : T.surface,
        borderRadius: 14,
        padding: 18,
        boxShadow: isPaid
          ? "0 1px 2px rgba(15,23,42,0.04), 0 10px 24px rgba(3,199,90,0.08)"
          : "0 1px 2px rgba(15,23,42,0.04), 0 4px 14px rgba(15,23,42,0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 14.5,
            fontWeight: 800,
            color: T.text,
            letterSpacing: -0.2,
          }}
        >
          현재 플랜
        </h3>
        <span
          style={{
            padding: "3px 10px",
            background: isPaid ? T.accent : "#eef0f4",
            color: isPaid ? "white" : T.textMuted,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            borderRadius: 999,
            boxShadow: isPaid ? `0 4px 10px ${T.accent}55` : "none",
          }}
        >
          {info.name}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 12.5, color: T.textMuted, lineHeight: 1.55 }}>
        {info.daily}
        {isPaid && periodEnd && (
          <>
            {" · "}
            {cancelAtPeriodEnd ? "취소 예정" : "다음 결제"}{" "}
            {new Date(periodEnd * 1000).toLocaleDateString()}
          </>
        )}
      </p>

      <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {isPaid ? (
          <button
            onClick={async () => {
              setPortalErr(null);
              setBusy(true);
              try {
                await openBillingPortal();
              } catch (e) {
                setPortalErr((e as Error).message);
                setBusy(false);
              }
            }}
            disabled={busy}
            style={{
              padding: "9px 16px",
              background: "#f0f2f6",
              color: T.text,
              border: "none",
              borderRadius: 999,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: busy ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {busy ? "이동 중…" : "구독 관리"}
          </button>
        ) : (
          <Link
            href="/pricing"
            style={{
              padding: "9px 16px",
              background: "linear-gradient(135deg, #03C75A 0%, #04a04a 100%)",
              color: "white",
              borderRadius: 999,
              fontSize: 12.5,
              fontWeight: 800,
              textDecoration: "none",
              boxShadow: "0 6px 14px rgba(3,199,90,0.4)",
            }}
          >
            업그레이드
          </Link>
        )}
        <Link
          href="/pricing"
          style={{
            padding: "9px 16px",
            background: "transparent",
            color: T.textMuted,
            borderRadius: 999,
            fontSize: 12.5,
            fontWeight: 600,
            textDecoration: "none",
            boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.1)",
          }}
        >
          요금제 보기
        </Link>
      </div>

      {portalErr && (
        <p style={{ marginTop: 8, fontSize: 11.5, color: "#dc2626" }}>{portalErr}</p>
      )}
    </div>
  );
}
