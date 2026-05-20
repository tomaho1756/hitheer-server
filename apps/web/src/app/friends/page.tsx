"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth-context";
import {
  inviteFriendToCall,
  respondFriendRequest,
  sendFriendRequest,
  subscribeFriends,
  subscribeRequests,
  subscribeSentRequests,
  type Friend,
  type FriendRequest,
  type SentRequest,
} from "@/lib/friends";
import { loadPrefs } from "@/lib/languages";

const ACCENT = "#03C75A";
const ACCENT_DEEP = "#02a949";
const SURFACE = "#ffffff";
const TEXT = "#18191a";
const TEXT_MUTED = "#65676b";
const BG = "#f6f7fa";
const CARD_SHADOW =
  "0 1px 2px rgba(15,23,42,0.04), 0 6px 22px rgba(15,23,42,0.06)";

export default function FriendsPage() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const [tab, setTab] = useState<"friends" | "incoming" | "sent">("friends");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [sent, setSent] = useState<SentRequest[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/signin?next=/friends");
      return;
    }
    const unsubF = subscribeFriends(user.uid, setFriends);
    const unsubR = subscribeRequests(user.uid, setRequests);
    const unsubS = subscribeSentRequests(user.uid, setSent);
    return () => {
      unsubF();
      unsubR();
      unsubS();
    };
  }, [ready, user, router]);

  const incomingBadge = requests.length;
  const tabs: Array<{ key: typeof tab; label: string; count?: number }> = useMemo(
    () => [
      { key: "friends", label: "친구", count: friends.length },
      { key: "incoming", label: "받은 요청", count: incomingBadge },
      { key: "sent", label: "보낸 요청", count: sent.length },
    ],
    [friends.length, incomingBadge, sent.length]
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.trim()) return;
    try {
      setBusy(true);
      await sendFriendRequest(email.trim());
      setInfo("요청을 보냈어요");
      setEmail("");
    } catch (e) {
      setError(prettifyErr((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const startCallWith = async (friend: Friend) => {
    if (!user) return;
    const { speaks, wants } = loadPrefs();
    const mine = speaks[0] ?? "ko";
    const peer = wants[0] ?? "en";
    const roomId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `r-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      await inviteFriendToCall({
        friendUid: friend.friendUid,
        roomId,
        mineLang: mine,
        peerLang: peer,
      });
    } catch (e) {
      setError(prettifyErr((e as Error).message));
      return;
    }
    router.push(`/call/${roomId}?mine=${mine}&peer=${peer}&host=1`);
  };

  return (
    <main style={{ background: BG, minHeight: "100vh", padding: "40px 20px 60px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <header style={{ marginBottom: 22, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/profile" style={{ color: TEXT_MUTED, fontSize: 13, textDecoration: "none" }}>
            ← 프로필
          </Link>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: TEXT, letterSpacing: -0.3 }}>
            친구
          </h1>
          <span style={{ width: 60 }} />
        </header>

        {/* Email add form */}
        <form
          onSubmit={submit}
          style={{
            display: "flex",
            gap: 8,
            background: SURFACE,
            borderRadius: 14,
            padding: 14,
            boxShadow: CARD_SHADOW,
            marginBottom: 18,
          }}
        >
          <input
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="친구 이메일 주소"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: 10,
              border: "none",
              background: "#f0f2f6",
              color: TEXT,
              fontSize: 14,
              fontFamily: "inherit",
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={busy || !email.trim()}
            style={{
              padding: "10px 18px",
              background: busy ? "#cfeadb" : "linear-gradient(135deg, #03C75A 0%, #04a04a 100%)",
              color: "white",
              border: "none",
              borderRadius: 10,
              fontWeight: 800,
              fontSize: 13.5,
              cursor: busy ? "not-allowed" : "pointer",
              boxShadow: "0 6px 14px rgba(3,199,90,0.35)",
              fontFamily: "inherit",
            }}
          >
            {busy ? "전송 중…" : "요청 보내기"}
          </button>
        </form>
        {error && (
          <p style={{ margin: "0 0 10px", color: "#dc2626", fontSize: 12.5 }}>{error}</p>
        )}
        {info && (
          <p style={{ margin: "0 0 10px", color: ACCENT_DEEP, fontSize: 12.5 }}>{info}</p>
        )}

        {/* Tabs */}
        <div
          role="tablist"
          style={{
            display: "flex",
            background: SURFACE,
            borderRadius: 999,
            padding: 4,
            boxShadow: CARD_SHADOW,
            marginBottom: 16,
            gap: 4,
          }}
        >
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  background: active ? ACCENT : "transparent",
                  color: active ? "white" : TEXT_MUTED,
                  border: "none",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: active ? 800 : 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "inline-flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 6,
                  transition: "background 0.18s",
                }}
              >
                {t.label}
                {typeof t.count === "number" && t.count > 0 && (
                  <span
                    style={{
                      background: active ? "rgba(255,255,255,0.25)" : "#e8f8ee",
                      color: active ? "white" : ACCENT_DEEP,
                      fontSize: 10.5,
                      fontWeight: 800,
                      padding: "1px 7px",
                      borderRadius: 999,
                      minWidth: 18,
                      textAlign: "center",
                    }}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {tab === "friends" && (
          <List
            items={friends}
            empty="아직 친구가 없어요. 위에서 이메일로 요청을 보내보세요."
            renderItem={(f) => (
              <Row
                key={f.friendUid}
                title={f.displayName || f.email || f.friendUid}
                subtitle={f.email}
                action={
                  <button onClick={() => void startCallWith(f)} style={primaryActionStyle}>
                    통화 시작
                  </button>
                }
              />
            )}
          />
        )}

        {tab === "incoming" && (
          <List
            items={requests}
            empty="받은 요청이 없어요."
            renderItem={(r) => (
              <Row
                key={r.senderUid}
                title={r.senderName || r.senderEmail || r.senderUid}
                subtitle={r.senderEmail}
                action={
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() =>
                        respondFriendRequest(r.senderUid, true).catch((e) =>
                          setError(prettifyErr((e as Error).message))
                        )
                      }
                      style={primaryActionStyle}
                    >
                      수락
                    </button>
                    <button
                      onClick={() =>
                        respondFriendRequest(r.senderUid, false).catch((e) =>
                          setError(prettifyErr((e as Error).message))
                        )
                      }
                      style={ghostActionStyle}
                    >
                      거절
                    </button>
                  </div>
                }
              />
            )}
          />
        )}

        {tab === "sent" && (
          <List
            items={sent}
            empty="보낸 요청이 없어요."
            renderItem={(s) => (
              <Row
                key={s.recipientUid}
                title={s.recipientName || s.recipientEmail || s.recipientUid}
                subtitle={s.recipientEmail}
                action={<span style={{ fontSize: 12, color: TEXT_MUTED }}>대기 중</span>}
              />
            )}
          />
        )}
      </div>
    </main>
  );
}

function List<T>({
  items,
  empty,
  renderItem,
}: {
  items: T[];
  empty: string;
  renderItem: (t: T) => React.ReactNode;
}) {
  if (items.length === 0) {
    return (
      <div
        style={{
          background: SURFACE,
          borderRadius: 14,
          padding: "30px 18px",
          boxShadow: CARD_SHADOW,
          textAlign: "center",
          color: TEXT_MUTED,
          fontSize: 13.5,
        }}
      >
        {empty}
      </div>
    );
  }
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map(renderItem)}
    </ul>
  );
}

function Row({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action: React.ReactNode;
}) {
  return (
    <li
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "14px 16px",
        background: SURFACE,
        borderRadius: 12,
        boxShadow: CARD_SHADOW,
        gap: 10,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: TEXT,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              marginTop: 2,
              fontSize: 12,
              color: TEXT_MUTED,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {action}
    </li>
  );
}

const primaryActionStyle: React.CSSProperties = {
  padding: "7px 14px",
  background: ACCENT,
  color: "white",
  border: "none",
  borderRadius: 999,
  fontSize: 12.5,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
  boxShadow: `0 4px 10px ${ACCENT}55`,
};

const ghostActionStyle: React.CSSProperties = {
  padding: "7px 14px",
  background: "transparent",
  color: TEXT_MUTED,
  border: "none",
  borderRadius: 999,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.12)",
};

function prettifyErr(code: string): string {
  switch (code) {
    case "user_not_found":
      return "해당 이메일의 사용자가 없어요.";
    case "already_friends":
      return "이미 친구예요.";
    case "already_requested":
      return "이미 요청을 보냈어요.";
    case "cannot_friend_self":
      return "본인에게 요청은 보낼 수 없어요.";
    case "not_friends":
      return "친구 관계가 아니어서 통화를 걸 수 없어요.";
    default:
      return code || "요청 실패";
  }
}
