"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { SignalingClient, signalingUrl } from "@/lib/signaling";
import {
  attachLocalMedia,
  createPeerConnection,
  fetchIceServers,
  setTrackEnabled,
} from "@/lib/peer";

type Status =
  | "idle"
  | "connecting"
  | "waiting-peer"
  | "negotiating"
  | "connected"
  | "reconnecting"
  | "failed"
  | "closed";

export default function CallPage() {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();
  const roomId = decodeURIComponent(params.roomId);

  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const signalingRef = useRef<SignalingClient | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const restartAttempts = useRef(0);
  const isPolite = useRef(false);
  const disconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [iceState, setIceState] = useState<string>("new");
  const [log, setLog] = useState<string[]>([]);
  const [mediaNote, setMediaNote] = useState<string | null>(null);
  const [hasLocalVideo, setHasLocalVideo] = useState(false);
  const [hasLocalAudio, setHasLocalAudio] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);

  const appendLog = (line: string) => {
    setLog((prev) => [...prev.slice(-60), `${new Date().toLocaleTimeString()} ${line}`]);
  };

  useEffect(() => {
    let cancelled = false;

    const wireRemoteStream = (stream: MediaStream) => {
      remoteStreamRef.current = stream;
      if (remoteVideo.current) remoteVideo.current.srcObject = stream;
      const recompute = () => {
        const v = stream.getVideoTracks()[0];
        setRemoteHasVideo(!!v && !v.muted && v.readyState === "live");
      };
      recompute();
      for (const t of stream.getVideoTracks()) {
        t.onmute = recompute;
        t.onunmute = recompute;
        t.onended = recompute;
      }
      stream.onaddtrack = recompute;
      stream.onremovetrack = recompute;
    };

    const start = async () => {
      setStatus("connecting");
      const iceServers = await fetchIceServers();
      appendLog(`ice servers: ${iceServers.map((s) => s.urls).flat().join(", ")}`);

      const pc = createPeerConnection(iceServers, {
        onLocalIce: (candidate) => signalingRef.current?.send({ type: "ice-candidate", candidate }),
        onRemoteStream: (stream) => {
          appendLog(`remote stream: video=${stream.getVideoTracks().length} audio=${stream.getAudioTracks().length}`);
          wireRemoteStream(stream);
        },
        onConnectionState: (state) => {
          appendLog(`connection: ${state}`);
          if (state === "connected") {
            setStatus("connected");
            restartAttempts.current = 0;
          }
          if (state === "failed") tryRecover(pc);
          if (state === "closed") setStatus("closed");
        },
        onIceState: (state) => {
          appendLog(`ice: ${state}`);
          setIceState(state);
          if (state === "disconnected") {
            if (disconnectTimer.current) clearTimeout(disconnectTimer.current);
            disconnectTimer.current = setTimeout(() => {
              if (pc.iceConnectionState === "disconnected") tryRecover(pc);
            }, 10_000);
            setStatus("reconnecting");
          } else if (state === "connected" || state === "completed") {
            if (disconnectTimer.current) {
              clearTimeout(disconnectTimer.current);
              disconnectTimer.current = null;
            }
          } else if (state === "failed") {
            tryRecover(pc);
          }
        },
        onNegotiationNeeded: async () => {
          if (!isPolite.current) return;
          try {
            const offer = await pc.createOffer({ iceRestart: false });
            await pc.setLocalDescription(offer);
            signalingRef.current?.send({ type: "offer", sdp: offer.sdp ?? "" });
          } catch (e) {
            appendLog(`renegotiate failed: ${(e as Error).message}`);
          }
        },
      });
      pcRef.current = pc;

      try {
        const result = await attachLocalMedia(pc);
        if (cancelled) return;
        localStreamRef.current = result.stream;
        setHasLocalVideo(result.hasVideo);
        setHasLocalAudio(result.hasAudio);
        setCamOn(result.hasVideo);
        setMicOn(result.hasAudio);
        if (result.note) {
          setMediaNote(result.note);
          appendLog(result.note);
        }
        if (localVideo.current) localVideo.current.srcObject = result.stream;
      } catch (e) {
        appendLog(`media error: ${(e as Error).message}`);
        setStatus("failed");
        setMediaNote((e as Error).message);
        return;
      }

      const signaling = new SignalingClient(signalingUrl(), async (msg) => {
        switch (msg.type) {
          case "joined":
            appendLog(`joined room (peerCount=${msg.peerCount}, shouldOffer=${msg.shouldOffer})`);
            setStatus(msg.peerCount < 2 ? "waiting-peer" : "negotiating");
            isPolite.current = msg.shouldOffer;
            if (msg.shouldOffer) {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              signaling.send({ type: "offer", sdp: offer.sdp ?? "" });
            }
            break;
          case "peer-joined":
            appendLog("peer joined — waiting for their offer");
            setStatus("negotiating");
            break;
          case "peer-left":
            appendLog("peer left");
            setStatus("waiting-peer");
            if (remoteVideo.current) remoteVideo.current.srcObject = null;
            remoteStreamRef.current = null;
            setRemoteHasVideo(false);
            break;
          case "offer": {
            await pc.setRemoteDescription({ type: "offer", sdp: msg.sdp });
            await drainIce(pc, pendingIce.current);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            signaling.send({ type: "answer", sdp: answer.sdp ?? "" });
            break;
          }
          case "answer":
            await pc.setRemoteDescription({ type: "answer", sdp: msg.sdp });
            await drainIce(pc, pendingIce.current);
            break;
          case "ice-candidate":
            if (pc.remoteDescription) {
              await pc.addIceCandidate(msg.candidate);
            } else {
              pendingIce.current.push(msg.candidate);
            }
            break;
          case "error":
            appendLog(`server error: ${msg.message}`);
            setStatus("failed");
            break;
        }
      });
      signalingRef.current = signaling;

      try {
        await signaling.connect();
      } catch {
        appendLog("signaling connect failed");
        setStatus("failed");
        return;
      }
      signaling.send({ type: "join", roomId });
    };

    const tryRecover = async (pc: RTCPeerConnection) => {
      if (restartAttempts.current >= 1) {
        appendLog("ICE restart already attempted — giving up");
        setStatus("failed");
        return;
      }
      restartAttempts.current += 1;
      appendLog("attempting ICE restart");
      setStatus("reconnecting");
      try {
        if (!isPolite.current) return;
        const offer = await pc.createOffer({ iceRestart: true });
        await pc.setLocalDescription(offer);
        signalingRef.current?.send({ type: "offer", sdp: offer.sdp ?? "" });
      } catch (e) {
        appendLog(`ICE restart failed: ${(e as Error).message}`);
        setStatus("failed");
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (disconnectTimer.current) clearTimeout(disconnectTimer.current);
      const s = signalingRef.current;
      if (s?.isOpen) s.send({ type: "leave" });
      s?.close();
      pcRef.current?.getSenders().forEach((s) => s.track?.stop());
      pcRef.current?.close();
    };
  }, [roomId]);

  const toggleMic = () => {
    const next = !micOn;
    setTrackEnabled(localStreamRef.current, "audio", next);
    setMicOn(next);
  };
  const toggleCam = () => {
    if (!hasLocalVideo) return;
    const next = !camOn;
    setTrackEnabled(localStreamRef.current, "video", next);
    setCamOn(next);
  };
  const leave = () => {
    router.push("/");
  };

  return (
    <main style={{ padding: 16, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <strong style={{ fontSize: 13, color: "#9aa3af" }}>room: {roomId.slice(0, 8)}…</strong>
        <span style={{ color: statusColor(status), fontSize: 13 }}>
          {status} (ice: {iceState})
        </span>
      </header>

      {mediaNote && (
        <div
          style={{
            padding: "8px 12px",
            background: "#1f2937",
            border: "1px solid #374151",
            color: "#fbbf24",
            borderRadius: 6,
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {mediaNote}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          flex: 1,
          minHeight: 0,
        }}
      >
        <VideoTile
          label="you"
          videoRef={localVideo}
          muted
          showPlaceholder={!hasLocalVideo || !camOn}
          placeholderText={!hasLocalVideo ? "no camera" : "camera off"}
        />
        <VideoTile
          label="peer"
          videoRef={remoteVideo}
          showPlaceholder={!remoteHasVideo}
          placeholderText={status === "connected" ? "audio only" : "waiting…"}
        />
      </div>

      <footer style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
        <ControlBtn
          on={micOn}
          disabled={!hasLocalAudio}
          onClick={toggleMic}
          label={micOn ? "🎙 mic on" : "🔇 mic off"}
        />
        <ControlBtn
          on={camOn}
          disabled={!hasLocalVideo}
          onClick={toggleCam}
          label={camOn ? "🎥 cam on" : "📷 cam off"}
        />
        <button
          onClick={leave}
          style={{
            padding: "10px 16px",
            background: "#dc2626",
            color: "white",
            border: "none",
            borderRadius: 999,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          ✕ leave
        </button>
      </footer>

      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: "pointer", color: "#6b7280", fontSize: 12 }}>events</summary>
        <pre
          style={{
            background: "#11141a",
            padding: 8,
            borderRadius: 6,
            maxHeight: 200,
            overflow: "auto",
            fontSize: 11,
            color: "#9aa3af",
          }}
        >
          {log.join("\n")}
        </pre>
      </details>
    </main>
  );
}

function ControlBtn({
  on,
  disabled,
  onClick,
  label,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 16px",
        background: disabled ? "#1f2937" : on ? "#1a1d22" : "#4b5563",
        color: disabled ? "#4b5563" : "white",
        border: `1px solid ${on ? "#2a2f37" : "#6b7280"}`,
        borderRadius: 999,
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 14,
      }}
    >
      {label}
    </button>
  );
}

function VideoTile({
  label,
  videoRef,
  muted,
  showPlaceholder,
  placeholderText,
}: {
  label: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  muted?: boolean;
  showPlaceholder: boolean;
  placeholderText: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        background: "#11141a",
        borderRadius: 8,
        overflow: "hidden",
        aspectRatio: "16/9",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: showPlaceholder ? "none" : "block",
        }}
      />
      {showPlaceholder && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            color: "#9aa3af",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "#1f2937",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              color: "#9aa3af",
            }}
          >
            {label === "you" ? "🧑" : "👤"}
          </div>
          <span style={{ fontSize: 13 }}>{placeholderText}</span>
        </div>
      )}
      <span
        style={{
          position: "absolute",
          bottom: 8,
          left: 8,
          background: "rgba(0,0,0,0.55)",
          padding: "2px 8px",
          borderRadius: 4,
          fontSize: 12,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function statusColor(s: Status): string {
  switch (s) {
    case "connected":
      return "#34d399";
    case "failed":
      return "#f87171";
    case "closed":
      return "#9aa3af";
    case "reconnecting":
      return "#fb923c";
    default:
      return "#fbbf24";
  }
}

async function drainIce(pc: RTCPeerConnection, queue: RTCIceCandidateInit[]) {
  while (queue.length) {
    const c = queue.shift();
    if (c) await pc.addIceCandidate(c);
  }
}
