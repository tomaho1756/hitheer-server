"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { useAuth } from "@/lib/auth-context";
import { listConversations, type ConversationSummary } from "@/lib/conversations";

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
};

const CARD_SHADOW =
  "0 1px 2px rgba(15,23,42,0.04), 0 4px 14px rgba(15,23,42,0.04)";

export function MobileHistory() {
  const { user, ready } = useAuth();
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    listConversations(user?.uid)
      .then(setItems)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [ready, user]);

  return (
    <MobileFrame title="대화 기록" contentBg={T.bg}>
      <div style={{ padding: "12px 14px 24px", flex: 1 }}>
        {loading && (
          <p style={{ color: T.textMuted, fontSize: 13, textAlign: "center", padding: "40px 0" }}>
            불러오는 중…
          </p>
        )}
        {error && <p style={{ color: "#dc2626", fontSize: 13, textAlign: "center" }}>{error}</p>}
        {!loading && !error && items.length === 0 && <EmptyState />}
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {items.map((it) => (
            <li key={it.id}>
              <Link
                href={`/history/${it.id}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 14px",
                  background: T.surface,
                  borderRadius: 14,
                  textDecoration: "none",
                  color: T.text,
                  boxShadow: CARD_SHADOW,
                  transition: "transform 0.15s",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
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
                        background: T.accentSoft,
                        color: T.accentDeep,
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
                    <span style={{ fontSize: 11.5, color: T.textMuted }}>
                      {formatRelative(it.startedAt)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: T.textMuted }}>
                    {it.messageCount}개 메시지 · {formatDuration(it.endedAt - it.startedAt)}
                  </div>
                </div>
                <span style={{ color: T.textMuted, fontSize: 16, paddingLeft: 8 }}>›</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </MobileFrame>
  );
}

function EmptyState() {
  return (
    <div style={{ textAlign: "center", color: T.textMuted, padding: "60px 16px" }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>📝</div>
      <p style={{ fontSize: 14, margin: 0 }}>아직 대화 기록이 없어요</p>
      <p style={{ fontSize: 12, color: T.textFaint, marginTop: 6 }}>
        매칭이나 방 만들기로 첫 통화를 시작해보세요.
      </p>
    </div>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금";
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
