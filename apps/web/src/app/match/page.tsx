"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { SignalingClient, signalingUrl } from "@/lib/signaling";
import { loadPrefs } from "@/lib/languages";
import { getIdToken } from "@/lib/auth-context";

type Status = "connecting" | "queued" | "matched" | "failed" | "no-prefs";

const EXPAND_AFTER_SECS = 60;

export default function MatchPage() {
  const router = useRouter();
  const signalingRef = useRef<SignalingClient | null>(null);
  const allowAnyRef = useRef(false);
  const [status, setStatus] = useState<Status>("connecting");
  const [elapsed, setElapsed] = useState(0);
  const [askExpand, setAskExpand] = useState(false);
  const [allowAny, setAllowAny] = useState(false);

  useEffect(() => {
    const prefs = loadPrefs();
    if (prefs.speaks.length === 0 || prefs.wants.length === 0) {
      setStatus("no-prefs");
      return;
    }

    const startedAt = Date.now();
    const tick = setInterval(() => {
      const secs = Math.floor((Date.now() - startedAt) / 1000);
      setElapsed(secs);
      if (secs >= EXPAND_AFTER_SECS && !allowAnyRef.current) setAskExpand(true);
    }, 500);

    let cancelled = false;

    void (async () => {
      const idToken = await getIdToken().catch(() => null);
      if (cancelled) return;
      const signaling = new SignalingClient(signalingUrl(idToken), (msg) => {
        if (cancelled) return;
        switch (msg.type) {
          case "queued":
            setStatus("queued");
            break;
          case "match-found": {
            setStatus("matched");
            signaling.close();
            const q = new URLSearchParams({
              mine: msg.mySpeaks,
              peer: msg.partnerSpeaks,
            });
            router.push(`/call/${encodeURIComponent(msg.roomId)}?${q.toString()}`);
            break;
          }
          case "error":
            setStatus("failed");
            break;
        }
      });
      signalingRef.current = signaling;

      try {
        await signaling.connect();
        if (cancelled) return;
        signaling.send({ type: "find-match", ...prefs, allowAny: false });
      } catch {
        if (!cancelled) setStatus("failed");
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(tick);
      const s = signalingRef.current;
      if (s?.isOpen) s.send({ type: "cancel-match" });
      s?.close();
    };
  }, [router]);

  const expand = () => {
    const prefs = loadPrefs();
    allowAnyRef.current = true;
    setAllowAny(true);
    setAskExpand(false);
    signalingRef.current?.send({ type: "cancel-match" });
    signalingRef.current?.send({ type: "find-match", ...prefs, allowAny: true });
  };

  const keepWaiting = () => {
    setAskExpand(false);
  };

  const ACCENT = "#03C75A";
  const SURFACE = "#ffffff";
  const SURFACE_ALT = "#f1f3f5";
  const BORDER = "#e5e7eb";
  const TEXT = "#18191a";
  const TEXT_MUTED = "#65676b";

  if (status === "no-prefs") {
    return (
      <main
        style={{
          maxWidth: 440,
          margin: "20vh auto",
          padding: 28,
          textAlign: "center",
          background: SURFACE,
          borderRadius: 16,
          border: `1px solid ${BORDER}`,
          boxShadow: "0 4px 16px rgba(15,23,42,0.06)",
        }}
      >
        <h1 style={{ fontSize: 20, marginTop: 0, color: TEXT }}>missing language preferences</h1>
        <p style={{ color: TEXT_MUTED, fontSize: 13.5 }}>
          Pick languages on the home page first.
        </p>
        <button
          onClick={() => router.push("/")}
          style={{
            marginTop: 16,
            padding: "10px 22px",
            background: ACCENT,
            color: "white",
            border: "none",
            borderRadius: 10,
            cursor: "pointer",
            fontWeight: 600,
            boxShadow: `0 4px 10px ${ACCENT}40`,
          }}
        >
          Go home
        </button>
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: 440,
        margin: "20vh auto",
        padding: 32,
        textAlign: "center",
        background: SURFACE,
        borderRadius: 16,
        border: `1px solid ${BORDER}`,
        boxShadow: "0 4px 16px rgba(15,23,42,0.06)",
      }}
    >
      <Spinner accent={ACCENT} />
      <h1 style={{ marginTop: 16, marginBottom: 6, fontSize: 20, color: TEXT, fontWeight: 700 }}>
        {label(status)}
      </h1>
      <p style={{ color: TEXT_MUTED, fontSize: 13.5, margin: 0 }}>
        {sub(status, elapsed, allowAny)}
      </p>

      {askExpand && (
        <div
          style={{
            marginTop: 22,
            padding: 16,
            background: SURFACE_ALT,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
          }}
        >
          <p style={{ margin: "0 0 12px", color: TEXT, fontSize: 13.5 }}>
            No one matched in {EXPAND_AFTER_SECS}s. Open up to anyone?
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button
              onClick={expand}
              style={{
                padding: "8px 16px",
                background: ACCENT,
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              Yes, expand
            </button>
            <button
              onClick={keepWaiting}
              style={{
                padding: "8px 16px",
                background: SURFACE,
                color: TEXT,
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Keep waiting
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => router.push("/")}
        style={{
          marginTop: 28,
          padding: "10px 18px",
          background: "transparent",
          color: TEXT_MUTED,
          border: `1px solid ${BORDER}`,
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        Cancel
      </button>
    </main>
  );
}

function Spinner({ accent }: { accent: string }) {
  return (
    <div
      style={{
        width: 48,
        height: 48,
        margin: "0 auto",
        border: `3px solid ${accent}33`,
        borderTopColor: accent,
        borderRadius: "50%",
        animation: "hitherespin 0.9s linear infinite",
      }}
    >
      <style>{`@keyframes hitherespin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function label(s: Status): string {
  if (s === "matched") return "match found";
  if (s === "failed") return "couldn't connect";
  return "looking for a partner…";
}

function sub(s: Status, elapsed: number, allowAny: boolean): string {
  if (s === "matched") return "joining call…";
  if (s === "failed") return "Check that the signaling server is running.";
  if (s === "queued") {
    return allowAny ? `waiting ${elapsed}s · global pool` : `waiting ${elapsed}s`;
  }
  return "connecting…";
}
