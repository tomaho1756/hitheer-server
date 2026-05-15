"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { SignalingClient, signalingUrl } from "@/lib/signaling";
import { loadPrefs } from "@/lib/languages";

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
    const signaling = new SignalingClient(signalingUrl(), (msg) => {
      if (cancelled) return;
      switch (msg.type) {
        case "queued":
          setStatus("queued");
          break;
        case "match-found":
          setStatus("matched");
          signaling.close();
          router.push(`/call/${encodeURIComponent(msg.roomId)}`);
          break;
        case "error":
          setStatus("failed");
          break;
      }
    });
    signalingRef.current = signaling;

    signaling
      .connect()
      .then(() => {
        if (cancelled) return;
        signaling.send({ type: "find-match", ...prefs, allowAny: false });
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });

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

  if (status === "no-prefs") {
    return (
      <main style={{ maxWidth: 480, margin: "20vh auto", padding: 24, textAlign: "center" }}>
        <h1>missing language preferences</h1>
        <p style={{ color: "#9aa3af" }}>Pick languages on the home page first.</p>
        <button
          onClick={() => router.push("/")}
          style={{
            marginTop: 24,
            padding: "10px 18px",
            background: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Go home
        </button>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: "20vh auto", padding: 24, textAlign: "center" }}>
      <h1 style={{ marginBottom: 12 }}>{label(status)}</h1>
      <p style={{ color: "#9aa3af" }}>{sub(status, elapsed, allowAny)}</p>

      {askExpand && (
        <div
          style={{
            marginTop: 24,
            padding: 16,
            background: "#11141a",
            border: "1px solid #2a2f37",
            borderRadius: 8,
          }}
        >
          <p style={{ margin: "0 0 12px" }}>
            No one matched in {EXPAND_AFTER_SECS}s. Open up to anyone?
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button
              onClick={expand}
              style={{
                padding: "8px 14px",
                background: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Yes, expand
            </button>
            <button
              onClick={keepWaiting}
              style={{
                padding: "8px 14px",
                background: "transparent",
                color: "#9aa3af",
                border: "1px solid #2a2f37",
                borderRadius: 6,
                cursor: "pointer",
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
          marginTop: 32,
          padding: "10px 18px",
          background: "transparent",
          color: "#9aa3af",
          border: "1px solid #2a2f37",
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        Cancel
      </button>
    </main>
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
