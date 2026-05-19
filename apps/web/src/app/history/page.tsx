"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { listConversations, type ConversationSummary } from "@/lib/conversations";
import { useAuth } from "@/lib/auth-context";
import { MobileHistory } from "@/components/mobile/history";

const ACCENT = "#03C75A";
const SURFACE = "#ffffff";
const SURFACE_ALT = "#f1f3f5";
const BORDER = "#e5e7eb";
const TEXT = "#18191a";
const TEXT_MUTED = "#65676b";

export default function HistoryPage() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/signin?next=/history");
      return;
    }
    setLoading(true);
    listConversations(user.uid)
      .then(setItems)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [ready, user, router]);

  if (!ready || !user) {
    return (
      <main style={{ padding: 40, textAlign: "center", color: TEXT_MUTED, fontSize: 13 }}>
        로그인 확인 중…
      </main>
    );
  }

  return (
    <>
      <div className="app-mobile-only">
        <MobileHistory />
      </div>
      <main
        className="app-desktop-only"
        style={{
          maxWidth: 680,
          margin: "6vh auto",
          padding: 28,
          background: SURFACE,
          borderRadius: 16,
          border: `1px solid ${BORDER}`,
          boxShadow: "0 4px 16px rgba(15,23,42,0.06)",
        }}
      >
        <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <Link
          href="/"
          style={{
            color: TEXT_MUTED,
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          ← Back
        </Link>
        <h1 style={{ margin: 0, fontSize: 18, color: TEXT, fontWeight: 700 }}>대화 기록</h1>
        <span style={{ width: 40 }} />
      </header>

      {loading && (
        <p style={{ color: TEXT_MUTED, fontSize: 13, textAlign: "center", margin: "32px 0" }}>
          불러오는 중…
        </p>
      )}
      {error && (
        <p style={{ color: "#dc2626", fontSize: 13, textAlign: "center" }}>
          {error}
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <div style={{ textAlign: "center", color: TEXT_MUTED, margin: "32px 0" }}>
          <p style={{ fontSize: 14 }}>아직 대화 기록이 없어요</p>
          <Link
            href="/"
            style={{
              display: "inline-block",
              marginTop: 12,
              padding: "8px 18px",
              background: ACCENT,
              color: "white",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            대화 시작하기
          </Link>
        </div>
      )}

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((it) => (
          <li key={it.id}>
            <Link
              href={`/history/${it.id}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 14px",
                background: SURFACE_ALT,
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                textDecoration: "none",
                color: TEXT,
                transition: "transform 0.12s, background 0.12s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#e8f8ee";
                e.currentTarget.style.transform = "translateX(2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = SURFACE_ALT;
                e.currentTarget.style.transform = "translateX(0)";
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      background: "#e8f8ee",
                      color: "#02a949",
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: 0.4,
                      textTransform: "uppercase",
                    }}
                  >
                    {it.speakerLang} → {it.partnerLang}
                  </span>
                  <span style={{ fontSize: 12, color: TEXT_MUTED }}>
                    {formatRelative(it.startedAt)}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: TEXT_MUTED }}>
                  {it.messageCount}개 메시지 · {formatDuration(it.endedAt - it.startedAt)}
                </div>
              </div>
              <span style={{ color: TEXT_MUTED, fontSize: 16 }}>›</span>
            </Link>
          </li>
        ))}
        </ul>
      </main>
    </>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(ts).toLocaleDateString();
}

function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  return `${m}분 ${s % 60}초`;
}
