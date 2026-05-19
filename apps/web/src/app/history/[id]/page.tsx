"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import { useAuth } from "@/lib/auth-context";
import { getConversation, type ConversationDetail } from "@/lib/conversations";

const ACCENT = "#03C75A";
const SURFACE = "#ffffff";
const SURFACE_ALT = "#f1f3f5";
const BORDER = "#e5e7eb";
const TEXT = "#18191a";
const TEXT_MUTED = "#65676b";

type Message = ConversationDetail["messages"][number];

export default function HistoryDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user, ready } = useAuth();
  const [data, setData] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    getConversation(id, user?.uid)
      .then((d) => {
        if (!d) throw new Error("not found");
        setData(d);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id, ready, user]);

  return (
    <main
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
          href="/history"
          style={{ color: TEXT_MUTED, fontSize: 13, textDecoration: "none" }}
        >
          ← History
        </Link>
        <h1 style={{ margin: 0, fontSize: 18, color: TEXT, fontWeight: 700 }}>
          대화
        </h1>
        <span style={{ width: 60 }} />
      </header>

      {loading && (
        <p style={{ color: TEXT_MUTED, fontSize: 13, textAlign: "center" }}>
          불러오는 중…
        </p>
      )}
      {error && (
        <p style={{ color: "#dc2626", fontSize: 13, textAlign: "center" }}>
          {error}
        </p>
      )}

      {data && (
        <>
          <div
            style={{
              padding: "10px 14px",
              background: SURFACE_ALT,
              borderRadius: 10,
              marginBottom: 16,
              fontSize: 12.5,
              color: TEXT_MUTED,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
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
                  marginRight: 8,
                }}
              >
                {data.speakerLang} → {data.partnerLang}
              </span>
              {new Date(data.startedAt).toLocaleString()}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span>{data.messageCount}개 메시지</span>
              <button
                disabled
                title="로그인 후 사용 가능"
                style={{
                  padding: "4px 10px",
                  background: SURFACE,
                  color: TEXT_MUTED,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 6,
                  fontSize: 11,
                  cursor: "not-allowed",
                }}
              >
                + 친구 추가
              </button>
              <button
                disabled
                title="로그인 후 사용 가능"
                style={{
                  padding: "4px 10px",
                  background: SURFACE,
                  color: TEXT_MUTED,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 6,
                  fontSize: 11,
                  cursor: "not-allowed",
                }}
              >
                📞 전화
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.messages.map((m, i) => (
              <Bubble key={i} m={m} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function Bubble({ m }: { m: Message }) {
  const mine = m.who === "me";
  return (
    <div
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "88%",
        background: mine ? ACCENT : SURFACE_ALT,
        color: mine ? "white" : TEXT,
        padding: "8px 12px",
        borderRadius: 12,
        borderBottomRightRadius: mine ? 4 : 12,
        borderBottomLeftRadius: mine ? 12 : 4,
        fontSize: 13,
        lineHeight: 1.45,
        boxShadow: mine
          ? `0 1px 3px ${ACCENT}66`
          : "0 1px 2px rgba(15,23,42,0.04)",
      }}
    >
      <div
        style={{
          opacity: 0.75,
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: 0.3,
          textTransform: "uppercase",
        }}
      >
        {mine ? "you" : "peer"} · {m.langOriginal} → {m.langTranslated}
      </div>
      {m.original && (
        <div style={{ marginTop: 3, opacity: 0.85, fontSize: 12.5 }}>{m.original}</div>
      )}
      {m.translated && (
        <div style={{ marginTop: 3, fontWeight: 600 }}>{m.translated}</div>
      )}
    </div>
  );
}
