"use client";

// Listens for friend-call invitations under users/{uid}/invitations/* and
// pops a global modal when one arrives. Mounted at the app root.

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth-context";
import { dismissInvitation, subscribeInvitations, type Invitation } from "@/lib/friends";

const ACCENT = "#03C75A";

export function InvitationListener() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [current, setCurrent] = useState<Invitation | null>(null);
  const [dismissedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!ready || !user) {
      setCurrent(null);
      return;
    }
    const unsub = subscribeInvitations(user.uid, (invs) => {
      const next = invs.find((i) => !dismissedIds.has(i.roomId));
      setCurrent(next ?? null);
    });
    return () => unsub();
  }, [ready, user, dismissedIds]);

  // Don't pop the modal on the call page itself — the recipient is already in
  // a call and another ring would be noisy.
  if (!current) return null;
  if (pathname?.startsWith("/call/")) return null;

  const accept = async () => {
    if (!user) return;
    router.push(
      `/call/${current.roomId}?mine=${current.mineLang}&peer=${current.peerLang}&fastjoin=1`
    );
    void dismissInvitation(user.uid, current.roomId);
    setCurrent(null);
  };
  const decline = async () => {
    if (!user) return;
    dismissedIds.add(current.roomId);
    await dismissInvitation(user.uid, current.roomId);
    setCurrent(null);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 20,
      }}
    >
      <div
        style={{
          maxWidth: 360,
          width: "100%",
          background: "#ffffff",
          borderRadius: 18,
          padding: 24,
          boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            margin: "0 auto 12px",
            borderRadius: 28,
            background: "linear-gradient(135deg, #03C75A 0%, #5ee49b 100%)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
            boxShadow: "0 10px 24px rgba(3,199,90,0.45)",
            animation: "ring 1.4s ease-in-out infinite",
          }}
        >
          📞
        </div>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "#18191a" }}>
          {current.fromName}님의 통화
        </h2>
        <p
          style={{
            marginTop: 6,
            fontSize: 13,
            color: "#65676b",
            lineHeight: 1.5,
          }}
        >
          친구가 영상 통화를 걸어왔어요.
        </p>
        <div
          style={{
            marginTop: 18,
            display: "flex",
            gap: 8,
            justifyContent: "center",
          }}
        >
          <button
            onClick={accept}
            style={{
              padding: "11px 22px",
              background: "linear-gradient(135deg, #03C75A 0%, #04a04a 100%)",
              color: "white",
              border: "none",
              borderRadius: 999,
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
              boxShadow: `0 8px 22px ${ACCENT}55`,
              fontFamily: "inherit",
            }}
          >
            받기
          </button>
          <button
            onClick={decline}
            style={{
              padding: "11px 22px",
              background: "#f0f2f6",
              color: "#18191a",
              border: "none",
              borderRadius: 999,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            거절
          </button>
        </div>
      </div>
      <style>
        {`@keyframes ring {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-8deg); }
          75% { transform: rotate(8deg); }
        }`}
      </style>
    </div>
  );
}
