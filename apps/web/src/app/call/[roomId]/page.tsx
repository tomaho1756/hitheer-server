"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { SignalingClient, signalingUrl } from "@/lib/signaling";
import {
  attachLocalMedia,
  createPeerConnection,
  fetchIceServers,
  setTrackEnabled,
} from "@/lib/peer";
import { startRealtime, type RealtimeHandle, type RealtimeSubtitleEvent } from "@/lib/realtime";
import { loadPrefs } from "@/lib/languages";
import { getIdToken, useAuth } from "@/lib/auth-context";
import { saveConversation as persistConversation } from "@/lib/conversations";

type Status =
  | "idle"
  | "connecting"
  | "waiting-peer"
  | "negotiating"
  | "connected"
  | "reconnecting"
  | "looking-next"
  | "failed"
  | "closed";

interface SubtitleLine {
  id: string;
  who: "me" | "peer";
  original: string;
  translated: string;
  langOriginal: string;
  langTranslated: string;
  ts: number;
  final: boolean;
}

export default function CallPage() {
  const params = useParams<{ roomId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const initialRoomId = decodeURIComponent(params.roomId);
  const mySpeaks = search.get("mine") ?? "";
  const partnerSpeaks = search.get("peer") ?? "";
  const isHost = search.get("host") === "1";

  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const signalingRef = useRef<SignalingClient | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const realtimeRef = useRef<RealtimeHandle | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const restartAttempts = useRef(0);
  const isPolite = useRef(false);
  const disconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iceServersRef = useRef<RTCIceServer[] | null>(null);
  const subtitlesRef = useRef<SubtitleLine[]>([]);
  const conversationStartRef = useRef<number>(Date.now());
  const currentRoomIdRef = useRef<string>(initialRoomId);

  const { user } = useAuth();
  const userRef = useRef<typeof user>(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const [currentRoomId, setCurrentRoomId] = useState(initialRoomId);
  const [status, setStatus] = useState<Status>("idle");
  const [iceState, setIceState] = useState<string>("new");
  const [log, setLog] = useState<string[]>([]);
  const [mediaNote, setMediaNote] = useState<string | null>(null);
  const [hasLocalVideo, setHasLocalVideo] = useState(false);
  const [hasLocalAudio, setHasLocalAudio] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);
  const [subtitles, setSubtitles] = useState<SubtitleLine[]>([]);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);

  const latestPeerSubtitle =
    [...subtitles].reverse().find((s) => s.who === "peer") ?? null;

  const [viewMode, setViewMode] = useState<"pip" | "split">("pip");
  const [showConversation, setShowConversation] = useState(true);
  const videoAreaRef = useRef<HTMLDivElement>(null);

  // Re-bind srcObject when the view mode flips — the <video> elements get
  // remounted across the conditional, so the previous srcObject gets lost.
  useEffect(() => {
    if (localVideo.current && localStreamRef.current) {
      localVideo.current.srcObject = localStreamRef.current;
    }
    if (remoteVideo.current && remoteStreamRef.current) {
      remoteVideo.current.srcObject = remoteStreamRef.current;
    }
  }, [viewMode]);

  const appendLog = (line: string) => {
    setLog((prev) => [...prev.slice(-60), `${new Date().toLocaleTimeString()} ${line}`]);
  };

  const pushSubtitle = (line: SubtitleLine) => {
    setSubtitles((prev) => {
      const idx = prev.findIndex((s) => s.id === line.id && s.who === line.who);
      let next: SubtitleLine[];
      if (idx >= 0) {
        next = [...prev];
        next[idx] = line;
      } else {
        next = [...prev.slice(-49), line];
      }
      subtitlesRef.current = next;
      return next;
    });
  };

  // Sync the current room id into a ref so async callbacks read the latest.
  useEffect(() => {
    currentRoomIdRef.current = currentRoomId;
  }, [currentRoomId]);

  const saveConversation = async () => {
    const messages = subtitlesRef.current;
    if (!messages.length) return;
    try {
      await persistConversation(
        {
          roomId: currentRoomIdRef.current,
          speakerLang: mySpeaks || "unknown",
          partnerLang: partnerSpeaks || "unknown",
          startedAt: conversationStartRef.current,
          endedAt: Date.now(),
          messages: messages.map((m) => ({
            who: m.who,
            original: m.original,
            translated: m.translated,
            langOriginal: m.langOriginal,
            langTranslated: m.langTranslated,
            ts: m.ts,
          })),
        },
        userRef.current?.uid
      );
      appendLog(
        `conversation saved (${messages.length} messages, ${userRef.current ? "firestore" : "sqlite"})`
      );
    } catch (e) {
      appendLog(`save failed: ${(e as Error).message}`);
    }
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

    const buildPeerConnection = (iceServers: RTCIceServer[]): RTCPeerConnection => {
      return createPeerConnection(iceServers, {
        onLocalIce: (candidate) =>
          signalingRef.current?.send({ type: "ice-candidate", candidate }),
        onRemoteStream: (stream) => {
          appendLog(
            `remote stream: video=${stream.getVideoTracks().length} audio=${stream.getAudioTracks().length}`
          );
          wireRemoteStream(stream);
        },
        onConnectionState: (state) => {
          appendLog(`connection: ${state}`);
          const pc = pcRef.current;
          if (state === "connected") {
            setStatus("connected");
            restartAttempts.current = 0;
          }
          if (state === "failed" && pc) tryRecover(pc);
          if (state === "closed") {
            // Only mark closed if this PC is still the active one — a fresh
            // rematch tears down the previous PC intentionally.
          }
        },
        onIceState: (state) => {
          appendLog(`ice: ${state}`);
          setIceState(state);
          const pc = pcRef.current;
          if (state === "disconnected" && pc) {
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
          } else if (state === "failed" && pc) {
            tryRecover(pc);
          }
        },
        onNegotiationNeeded: async () => {
          if (!isPolite.current) return;
          const pc = pcRef.current;
          if (!pc) return;
          try {
            const offer = await pc.createOffer({ iceRestart: false });
            await pc.setLocalDescription(offer);
            signalingRef.current?.send({ type: "offer", sdp: offer.sdp ?? "" });
          } catch (e) {
            appendLog(`renegotiate failed: ${(e as Error).message}`);
          }
        },
      });
    };

    const teardownPeerConnection = () => {
      if (disconnectTimer.current) {
        clearTimeout(disconnectTimer.current);
        disconnectTimer.current = null;
      }
      const pc = pcRef.current;
      if (pc) {
        // Detach receivers (peer's tracks). DO NOT stop senders — those are
        // our own mic/cam tracks that we re-attach to the next PC.
        try {
          pc.getReceivers().forEach((r) => {
            try {
              r.track?.stop();
            } catch {}
          });
        } catch {}
        try {
          pc.close();
        } catch {}
      }
      pcRef.current = null;
      pendingIce.current = [];
      restartAttempts.current = 0;
      remoteStreamRef.current = null;
      setRemoteHasVideo(false);
      if (remoteVideo.current) remoteVideo.current.srcObject = null;
    };

    const rebuildPeerConnection = () => {
      teardownPeerConnection();
      const iceServers = iceServersRef.current ?? [];
      const pc = buildPeerConnection(iceServers);
      pcRef.current = pc;
      const stream = localStreamRef.current;
      if (stream) {
        for (const t of stream.getTracks()) {
          try {
            pc.addTrack(t, stream);
          } catch (e) {
            appendLog(`addTrack failed: ${(e as Error).message}`);
          }
        }
      }
    };

    const joinRoom = (newRoomId: string) => {
      rebuildPeerConnection();
      conversationStartRef.current = Date.now();
      currentRoomIdRef.current = newRoomId;
      setCurrentRoomId(newRoomId);
      setStatus("connecting");
      signalingRef.current?.send({ type: "join", roomId: newRoomId });
    };

    const handlePeerLeft = async () => {
      await saveConversation();
      setSubtitles([]);
      subtitlesRef.current = [];
      teardownPeerConnection();
      if (isHost) {
        // Host mode: stay in the room, wait for someone else to join via link.
        setStatus("waiting-peer");
      } else {
        // Random match mode: auto-find next partner.
        setStatus("looking-next");
        signalingRef.current?.send({ type: "leave" });
        const prefs = loadPrefs();
        signalingRef.current?.send({
          type: "find-match",
          speaks: prefs.speaks.length ? prefs.speaks : [mySpeaks],
          wants: prefs.wants.length ? prefs.wants : [partnerSpeaks],
          allowAny: false,
        });
      }
    };

    const start = async () => {
      setStatus("connecting");
      const iceServers = await fetchIceServers();
      if (cancelled) return;
      iceServersRef.current = iceServers;
      appendLog(`ice servers: ${iceServers.map((s) => s.urls).flat().join(", ")}`);

      // Open signaling first so handlers are wired before we acquire media.
      const idToken = await getIdToken().catch(() => null);
      const signaling = new SignalingClient(signalingUrl(idToken), async (msg) => {
        const pc = pcRef.current;
        switch (msg.type) {
          case "queued":
            setStatus("looking-next");
            appendLog("queued for next match");
            break;
          case "match-found":
            appendLog(`matched into room ${msg.roomId.slice(0, 8)}`);
            joinRoom(msg.roomId);
            break;
          case "joined":
            appendLog(`joined room (peerCount=${msg.peerCount}, shouldOffer=${msg.shouldOffer})`);
            setStatus(msg.peerCount < 2 ? "waiting-peer" : "negotiating");
            isPolite.current = msg.shouldOffer;
            if (msg.shouldOffer && pc) {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              signaling.send({ type: "offer", sdp: offer.sdp ?? "" });
            }
            break;
          case "peer-joined":
            appendLog("peer joined — waiting for their offer");
            // If our previous PC was torn down (e.g. after peer-left in host
            // mode), we need a fresh PC ready to receive the new peer's offer.
            if (!pcRef.current) rebuildPeerConnection();
            setStatus("negotiating");
            break;
          case "peer-left":
            appendLog(isHost ? "peer left — waiting for next guest" : "peer left — finding next partner");
            await handlePeerLeft();
            break;
          case "offer": {
            if (!pc) break;
            await pc.setRemoteDescription({ type: "offer", sdp: msg.sdp });
            await drainIce(pc, pendingIce.current);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            signaling.send({ type: "answer", sdp: answer.sdp ?? "" });
            break;
          }
          case "answer":
            if (!pc) break;
            await pc.setRemoteDescription({ type: "answer", sdp: msg.sdp });
            await drainIce(pc, pendingIce.current);
            break;
          case "ice-candidate":
            if (!pc) break;
            if (pc.remoteDescription) {
              await pc.addIceCandidate(msg.candidate);
            } else {
              pendingIce.current.push(msg.candidate);
            }
            break;
          case "subtitle":
            pushSubtitle({
              id: `peer-${msg.id}`,
              who: "peer",
              original: msg.original,
              translated: msg.translated,
              langOriginal: msg.langOriginal,
              langTranslated: msg.langTranslated,
              ts: msg.ts,
              final: msg.final,
            });
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

      // Build the initial PC and acquire local media into it.
      const pc = buildPeerConnection(iceServers);
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

      // Join the initial room.
      conversationStartRef.current = Date.now();
      signaling.send({ type: "join", roomId: currentRoomIdRef.current });

      // Start realtime translator (lives for the whole session, not per-peer).
      if (
        localStreamRef.current?.getAudioTracks().length &&
        mySpeaks &&
        partnerSpeaks
      ) {
        try {
          const handle = await startRealtime({
            micStream: localStreamRef.current,
            speakerLang: mySpeaks,
            partnerLang: partnerSpeaks,
            onSubtitle: (e: RealtimeSubtitleEvent) => {
              pushSubtitle({
                id: `me-${e.id}`,
                who: "me",
                original: e.original,
                translated: e.translated,
                langOriginal: e.langOriginal,
                langTranslated: e.langTranslated,
                ts: e.ts,
                final: e.final,
              });
              signalingRef.current?.send({ type: "subtitle", ...e });
            },
            onError: (err) => {
              appendLog(`realtime: ${err.message}`);
              setRealtimeError(err.message);
            },
          });
          realtimeRef.current = handle;
          appendLog(`realtime translator started (${mySpeaks} → ${partnerSpeaks})`);
        } catch (e) {
          const msg = (e as Error).message;
          appendLog(`realtime start failed: ${msg}`);
          setRealtimeError(msg);
        }
      } else if (!mySpeaks || !partnerSpeaks) {
        appendLog("realtime skipped: missing language info");
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (disconnectTimer.current) clearTimeout(disconnectTimer.current);
      // Save current conversation on unmount (best-effort).
      void saveConversation();
      realtimeRef.current?.close();
      realtimeRef.current = null;
      const s = signalingRef.current;
      if (s?.isOpen) s.send({ type: "leave" });
      s?.close();
      // Stop the mic/cam tracks now that we're truly leaving the page.
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      pcRef.current?.close();
      pcRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mySpeaks, partnerSpeaks]);


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

  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const stopScreenShare = async () => {
    const screen = screenTrackRef.current;
    if (!screen) return;
    screenTrackRef.current = null;
    try {
      screen.onended = null;
      screen.stop();
    } catch {}

    const cam = cameraTrackRef.current;
    const localStream = localStreamRef.current;
    if (localStream) {
      // Remove whatever video track is in the stream.
      for (const t of localStream.getVideoTracks()) localStream.removeTrack(t);
      if (cam) localStream.addTrack(cam);
      if (localVideo.current) localVideo.current.srcObject = localStream;
    }
    const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === "video");
    if (sender) {
      try {
        await sender.replaceTrack(cam ?? null);
      } catch (e) {
        appendLog(`stop share replaceTrack failed: ${(e as Error).message}`);
      }
    }
    cameraTrackRef.current = null;
    setIsScreenSharing(false);
  };

  const startScreenShare = async () => {
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const screenTrack = screen.getVideoTracks()[0];
      if (!screenTrack) throw new Error("no video track in display stream");
      screenTrackRef.current = screenTrack;

      // Save the current camera track so we can restore it later.
      const localStream = localStreamRef.current;
      const cam = localStream?.getVideoTracks()[0] ?? null;
      cameraTrackRef.current = cam;

      if (localStream) {
        for (const t of localStream.getVideoTracks()) localStream.removeTrack(t);
        localStream.addTrack(screenTrack);
        if (localVideo.current) localVideo.current.srcObject = localStream;
      }
      const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === "video");
      if (sender) {
        try {
          await sender.replaceTrack(screenTrack);
        } catch (e) {
          appendLog(`screen replaceTrack failed: ${(e as Error).message}`);
        }
      }

      // Stop sharing if the user clicks the browser's "Stop sharing" bar.
      screenTrack.onended = () => {
        void stopScreenShare();
      };

      setIsScreenSharing(true);
      appendLog("screen sharing started");
    } catch (e) {
      const msg = (e as Error).message;
      if (msg !== "Permission denied") appendLog(`screen share failed: ${msg}`);
    }
  };

  const toggleScreenShare = () => {
    if (isScreenSharing) void stopScreenShare();
    else void startScreenShare();
  };
  const leave = async () => {
    await saveConversation();
    router.push("/");
  };

  const retranslate = async (lineId: string) => {
    const line = subtitles.find((s) => s.id === lineId);
    if (!line || !line.original) return;
    try {
      const res = await fetch(`${window.location.origin}/retranslate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: line.original,
          sourceLang: line.langOriginal,
          targetLang: line.langTranslated,
        }),
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => "")}`);
      const data = (await res.json()) as { translation: string };
      setSubtitles((prev) =>
        prev.map((s) => (s.id === lineId ? { ...s, translated: data.translation } : s))
      );
    } catch (e) {
      appendLog(`retranslate failed: ${(e as Error).message}`);
    }
  };

  return (
    <main
      style={{
        height: "100vh",
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        boxSizing: "border-box",
        background: T.bg,
        color: T.text,
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 10,
          boxShadow: T.shadowSm,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <BrandMark />
          <div style={{ fontSize: 12, color: T.textMuted, display: "flex", gap: 8 }}>
            <span style={{ fontFamily: "ui-monospace, monospace" }}>
              {currentRoomId.slice(0, 8)}
            </span>
            {mySpeaks && partnerSpeaks && (
              <span
                style={{
                  background: T.accentSoft,
                  color: T.accentDeep,
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontWeight: 600,
                  letterSpacing: 0.3,
                }}
              >
                {mySpeaks.toUpperCase()} → {partnerSpeaks.toUpperCase()}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            onClick={() => setViewMode((m) => (m === "pip" ? "split" : "pip"))}
            style={headerBtnStyle}
            title="toggle view mode"
          >
            {viewMode === "pip" ? <Icon.Split /> : <Icon.PiP />}
            {viewMode === "pip" ? "split" : "pip"}
          </button>
          <button
            onClick={() => setShowConversation((s) => !s)}
            style={headerBtnStyle}
            title="toggle conversation"
          >
            <Icon.Chat />
            {showConversation ? "hide" : "show"}
          </button>
          <span
            style={{
              color: statusColor(status),
              fontSize: 11,
              fontWeight: 600,
              padding: "4px 9px",
              background: T.surfaceAlt,
              borderRadius: 999,
              marginLeft: 4,
            }}
          >
            {statusLabel(status)}
          </span>
        </div>
      </header>

      {mediaNote && (
        <div style={noticeStyle("#fbbf24")}>{mediaNote}</div>
      )}
      {realtimeError && (
        <div style={noticeStyle("#f87171")}>translator: {realtimeError}</div>
      )}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: showConversation ? "1fr min(320px, 32vw)" : "1fr",
          gap: 8,
        }}
      >
        <div
          ref={videoAreaRef}
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 14,
            background: T.videoBg,
            minWidth: 0,
            minHeight: 0,
            boxShadow: T.shadowMd,
            border: `1px solid ${T.border}`,
          }}
        >
          {viewMode === "pip" ? (
            <>
              <FillingTile
                label="peer"
                videoRef={remoteVideo}
                showPlaceholder={!remoteHasVideo}
                placeholderText={peerPlaceholderText(status)}
              />
              {isHost && status === "waiting-peer" ? (
                <InviteOverlay />
              ) : (
                (status === "looking-next" || status === "waiting-peer") && (
                  <SearchingOverlay text={searchingText(status)} />
                )
              )}
              {latestPeerSubtitle && <SubtitleOverlay line={latestPeerSubtitle} />}
              <PipDraggable containerRef={videoAreaRef}>
                <FillingTile
                  label="you"
                  videoRef={localVideo}
                  muted
                  showPlaceholder={!hasLocalVideo || !camOn}
                  placeholderText={!hasLocalVideo ? "no camera" : "camera off"}
                />
              </PipDraggable>
            </>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 6,
                height: "100%",
                padding: 6,
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: 10,
                  background: T.videoBg,
                }}
              >
                <FillingTile
                  label="peer"
                  videoRef={remoteVideo}
                  showPlaceholder={!remoteHasVideo}
                  placeholderText={peerPlaceholderText(status)}
                />
                {isHost && status === "waiting-peer" ? (
                  <InviteOverlay />
                ) : (
                  (status === "looking-next" || status === "waiting-peer") && (
                    <SearchingOverlay text={searchingText(status)} />
                  )
                )}
                {latestPeerSubtitle && <SubtitleOverlay line={latestPeerSubtitle} />}
              </div>
              <div
                style={{
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: 10,
                  background: T.videoBg,
                }}
              >
                <FillingTile
                  label="you"
                  videoRef={localVideo}
                  muted
                  showPlaceholder={!hasLocalVideo || !camOn}
                  placeholderText={!hasLocalVideo ? "no camera" : "camera off"}
                />
              </div>
            </div>
          )}
        </div>

        {showConversation && <SubtitleList lines={subtitles} onRetranslate={retranslate} />}
      </div>

      <footer
        style={{
          display: "flex",
          gap: 12,
          justifyContent: "center",
          alignItems: "center",
          padding: "10px 14px",
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          boxShadow: T.shadowSm,
        }}
      >
        <ControlBtn
          disabled={!hasLocalAudio}
          onClick={toggleMic}
          icon={micOn ? <Icon.Mic /> : <Icon.MicOff />}
          tooltip={micOn ? "mute" : "unmute"}
          tone={micOn ? "neutral" : "danger"}
        />
        <ControlBtn
          disabled={!hasLocalVideo}
          onClick={toggleCam}
          icon={camOn ? <Icon.Video /> : <Icon.VideoOff />}
          tooltip={camOn ? "camera off" : "camera on"}
          tone={camOn ? "neutral" : "danger"}
        />
        <ControlBtn
          onClick={toggleScreenShare}
          icon={isScreenSharing ? <Icon.ScreenOn /> : <Icon.Screen />}
          tooltip={isScreenSharing ? "stop sharing" : "share screen"}
          tone={isScreenSharing ? "accent" : "neutral"}
        />
        <ControlBtn
          onClick={leave}
          icon={<Icon.PhoneOff />}
          tooltip="leave"
          tone="danger"
        />
      </footer>

      <details>
        <summary
          style={{
            cursor: "pointer",
            color: T.textFaint,
            fontSize: 11,
            padding: "2px 4px",
            userSelect: "none",
          }}
        >
          debug events
        </summary>
        <pre
          style={{
            background: T.surfaceAlt,
            padding: 10,
            borderRadius: 8,
            maxHeight: 160,
            overflow: "auto",
            fontSize: 11,
            color: T.textMuted,
            marginTop: 6,
            border: `1px solid ${T.border}`,
          }}
        >
          {log.join("\n")}
        </pre>
      </details>
    </main>
  );
}

function SubtitleList({
  lines,
  onRetranslate,
}: {
  lines: SubtitleLine[];
  onRetranslate: (id: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  return (
    <aside
      style={{
        background: T.surface,
        borderRadius: 12,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        border: `1px solid ${T.border}`,
        boxShadow: T.shadowSm,
      }}
    >
      <h3
        style={{
          margin: "0 0 10px",
          fontSize: 11,
          color: T.textMuted,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        conversation
      </h3>
      <div
        ref={scrollerRef}
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          paddingRight: 4,
        }}
      >
        {lines.length === 0 ? (
          <span style={{ fontSize: 12, color: T.textFaint }}>
            speak when you&rsquo;re ready — translations show up here.
          </span>
        ) : (
          lines.map((l) => <ChatBubble key={l.id} line={l} onRetranslate={onRetranslate} />)
        )}
      </div>
    </aside>
  );
}

function ChatBubble({
  line,
  onRetranslate,
}: {
  line: SubtitleLine;
  onRetranslate: (id: string) => void;
}) {
  const [hover, setHover] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleRetranslate = async () => {
    setMenuOpen(false);
    setBusy(true);
    try {
      await onRetranslate(line.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setMenuOpen(false);
      }}
      style={{
        position: "relative",
        alignSelf: line.who === "me" ? "flex-end" : "flex-start",
        maxWidth: "88%",
      }}
    >
      <div
        style={{
          background: line.who === "me" ? T.accent : T.surfaceAlt,
          color: line.who === "me" ? "white" : T.text,
          padding: "8px 12px",
          borderRadius: 12,
          borderBottomRightRadius: line.who === "me" ? 4 : 12,
          borderBottomLeftRadius: line.who === "me" ? 12 : 4,
          fontSize: 13,
          lineHeight: 1.45,
          opacity: busy ? 0.55 : 1,
          transition: "opacity 0.2s",
          boxShadow: line.who === "me" ? `0 1px 3px ${T.accent}66` : T.shadowSm,
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
          {line.who === "me" ? "you" : "peer"} · {line.langOriginal} → {line.langTranslated}
        </div>
        {line.original && (
          <div style={{ marginTop: 3, opacity: 0.85, fontSize: 12.5 }}>{line.original}</div>
        )}
        {line.translated && (
          <div style={{ marginTop: 3, fontWeight: 600 }}>{line.translated}</div>
        )}
      </div>

      {(hover || menuOpen) && line.final && line.original && (
        <button
          onClick={() => setMenuOpen((v) => !v)}
          style={{
            position: "absolute",
            top: -7,
            [line.who === "me" ? "left" : "right"]: -7,
            width: 22,
            height: 22,
            borderRadius: 11,
            background: T.surface,
            border: `1px solid ${T.border}`,
            color: T.text,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            boxShadow: T.shadowMd,
          }}
          title="more"
        >
          <Icon.More />
        </button>
      )}

      {menuOpen && (
        <div
          style={{
            position: "absolute",
            top: 22,
            [line.who === "me" ? "left" : "right"]: -4,
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            padding: 4,
            zIndex: 50,
            boxShadow: T.shadowLg,
            minWidth: 140,
          }}
        >
          <button
            onClick={handleRetranslate}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              background: "transparent",
              border: "none",
              color: T.text,
              padding: "7px 9px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12.5,
              textAlign: "left",
              fontWeight: 500,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = T.surfaceAlt)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <Icon.Refresh />
            재번역
          </button>
        </div>
      )}
    </div>
  );
}

function SubtitleOverlay({ line }: { line: SubtitleLine }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 18,
        left: "50%",
        transform: "translateX(-50%)",
        maxWidth: "min(70%, 640px)",
        background: "rgba(10, 12, 16, 0.78)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        padding: "10px 16px",
        borderRadius: 10,
        fontSize: 14,
        lineHeight: 1.4,
        color: "white",
        zIndex: 30,
        textAlign: "center",
        boxShadow: "0 8px 20px rgba(0,0,0,0.4)",
        border: `1px solid rgba(255,255,255,0.08)`,
      }}
    >
      <div
        style={{
          opacity: 0.6,
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}
      >
        {line.langOriginal} → {line.langTranslated}
      </div>
      {line.original && (
        <div style={{ marginTop: 3, opacity: 0.85, fontSize: 13 }}>{line.original}</div>
      )}
      {line.translated && (
        <div style={{ marginTop: 3, fontWeight: 600 }}>{line.translated}</div>
      )}
    </div>
  );
}

function ControlBtn({
  disabled,
  onClick,
  icon,
  tooltip,
  tone = "neutral",
}: {
  disabled?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  tooltip: string;
  tone?: "neutral" | "danger" | "accent";
}) {
  const bg = disabled
    ? T.surfaceAlt
    : tone === "danger"
    ? T.danger
    : tone === "accent"
    ? T.accent
    : T.surfaceAlt;
  const color = disabled
    ? T.textFaint
    : tone === "danger" || tone === "accent"
    ? "white"
    : T.text;
  const border =
    tone === "danger" ? T.dangerDeep : tone === "accent" ? T.accentDeep : T.border;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        background: bg,
        color,
        border: `1px solid ${border}`,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.15s",
        padding: 0,
        boxShadow:
          tone === "danger"
            ? `0 2px 8px ${T.danger}55`
            : tone === "accent"
            ? `0 2px 8px ${T.accent}55`
            : T.shadowSm,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = "scale(1.08)";
          if (tone === "neutral") e.currentTarget.style.background = T.surfaceHover;
          if (tone === "danger") e.currentTarget.style.background = T.dangerDeep;
          if (tone === "accent") e.currentTarget.style.background = T.accentDeep;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.background = bg;
      }}
    >
      {icon}
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
        height: "100%",
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
      return T.accent;
    case "failed":
      return T.danger;
    case "closed":
      return T.textFaint;
    case "reconnecting":
    case "looking-next":
      return "#f59e0b";
    default:
      return "#f59e0b";
  }
}

function statusLabel(s: Status): string {
  switch (s) {
    case "looking-next":
      return "다음 상대 찾는 중";
    case "waiting-peer":
      return "상대 기다리는 중";
    case "connected":
      return "connected";
    case "negotiating":
      return "연결 중";
    case "reconnecting":
      return "재연결 중";
    case "failed":
      return "failed";
    case "closed":
      return "closed";
    default:
      return s;
  }
}

function peerPlaceholderText(status: Status): string {
  switch (status) {
    case "looking-next":
      return "";
    case "waiting-peer":
      return "";
    case "connected":
      return "audio only";
    default:
      return "waiting…";
  }
}

function searchingText(status: Status): string {
  if (status === "looking-next") return "상대방이 나갔어요. 다음 상대 찾는 중…";
  return "상대 기다리는 중…";
}

function InviteOverlay() {
  const [copied, setCopied] = useState(false);
  const url = useInviteUrl();
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(10, 12, 16, 0.62)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        color: "white",
        zIndex: 15,
        padding: 24,
      }}
    >
      <div style={{ fontSize: 36 }}>🚪</div>
      <div style={{ fontSize: 15, fontWeight: 600 }}>친구를 초대하세요</div>
      <div style={{ fontSize: 12, opacity: 0.75 }}>
        아래 링크를 공유하면 같은 방으로 들어옵니다
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "stretch",
          maxWidth: 480,
          width: "100%",
        }}
      >
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.18)",
            color: "white",
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 12,
            fontFamily: "ui-monospace, monospace",
            minWidth: 0,
          }}
        />
        <button
          onClick={onCopy}
          style={{
            background: T.accent,
            color: "white",
            border: `1px solid ${T.accentDeep}`,
            padding: "8px 16px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
            boxShadow: `0 2px 8px ${T.accent}55`,
          }}
        >
          {copied ? "✓ 복사됨" : "📋 링크 복사"}
        </button>
      </div>
    </div>
  );
}

function useInviteUrl(): string {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    u.searchParams.delete("host");
    setUrl(u.toString());
  }, []);
  return url;
}

function SearchingOverlay({ text }: { text: string }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(10, 12, 16, 0.55)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        color: "white",
        zIndex: 15,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: `3px solid rgba(255,255,255,0.25)`,
          borderTopColor: "white",
          borderRadius: "50%",
          animation: "callspin 0.9s linear infinite",
        }}
      />
      <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: 0.2 }}>{text}</div>
      <style>{`@keyframes callspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function BrandMark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: T.accent,
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: 16,
          boxShadow: `0 2px 6px ${T.accent}55`,
        }}
      >
        h
      </div>
      <span style={{ fontSize: 14, fontWeight: 700, color: T.text, letterSpacing: -0.2 }}>
        hithere
      </span>
    </div>
  );
}

async function drainIce(pc: RTCPeerConnection, queue: RTCIceCandidateInit[]) {
  while (queue.length) {
    const c = queue.shift();
    if (c) await pc.addIceCandidate(c);
  }
}

const T = {
  bg: "#f7f8fa",
  surface: "#ffffff",
  surfaceAlt: "#f1f3f5",
  surfaceHover: "#eef0f3",
  border: "#e5e7eb",
  borderStrong: "#d1d5db",
  text: "#18191a",
  textMuted: "#65676b",
  textFaint: "#9ca3af",
  accent: "#03C75A",
  accentDeep: "#02a949",
  accentSoft: "#e8f8ee",
  danger: "#f02849",
  dangerDeep: "#d11b3b",
  videoBg: "#0a0c10",
  shadowSm: "0 1px 2px rgba(15, 23, 42, 0.06)",
  shadowMd: "0 2px 8px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04)",
  shadowLg: "0 6px 18px rgba(15, 23, 42, 0.12), 0 2px 6px rgba(15, 23, 42, 0.06)",
};

const Icon = {
  Mic: ({ size = 22 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  ),
  MicOff: ({ size = 22 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" x2="22" y1="2" y2="22" />
      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
      <path d="M5 10v2a7 7 0 0 0 12 5" />
      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  ),
  Video: ({ size = 22 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 8-6 4 6 4V8Z" />
      <rect width="14" height="12" x="2" y="6" rx="2" />
    </svg>
  ),
  VideoOff: ({ size = 22 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.66 6H14a2 2 0 0 1 2 2v2.34l1 1L22 8v8" />
      <path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2l10 10Z" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  ),
  PhoneOff: ({ size = 22 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-3.07-3.07A2 2 0 0 1 7.95 14" />
      <line x1="22" x2="2" y1="2" y2="22" />
    </svg>
  ),
  More: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  ),
  Refresh: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  ),
  Split: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <line x1="12" x2="12" y1="3" y2="21" />
    </svg>
  ),
  PiP: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 7V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-3" />
      <rect width="10" height="7" x="12" y="13" rx="2" />
    </svg>
  ),
  Chat: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Person: ({ size = 48 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="8" r="4" />
      <path d="M12 14c-4.4 0-8 2.7-8 6v2h16v-2c0-3.3-3.6-6-8-6z" />
    </svg>
  ),
  Screen: ({ size = 22 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  ),
  ScreenOn: ({ size = 22 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" fill="currentColor" fillOpacity="0.15" />
      <path d="M12 7v6m-3-3 3-3 3 3" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  ),
};

const headerBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  background: T.surface,
  border: `1px solid ${T.border}`,
  color: T.text,
  padding: "6px 11px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 500,
  boxShadow: T.shadowSm,
};

function noticeStyle(color: string): React.CSSProperties {
  return {
    padding: "8px 12px",
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderLeft: `3px solid ${color}`,
    color: T.text,
    borderRadius: 8,
    fontSize: 12,
    boxShadow: T.shadowSm,
  };
}

function FillingTile({
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
    <div style={{ position: "absolute", inset: 0, background: T.videoBg }}>
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
            gap: 10,
            color: "rgba(255,255,255,0.7)",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,255,255,0.55)",
            }}
          >
            <Icon.Person size={36} />
          </div>
          <span style={{ fontSize: 12 }}>{placeholderText}</span>
        </div>
      )}
      <span
        style={{
          position: "absolute",
          bottom: 8,
          left: 8,
          background: "rgba(0,0,0,0.55)",
          padding: "3px 9px",
          borderRadius: 6,
          fontSize: 11,
          color: "white",
          fontWeight: 600,
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
    </div>
  );
}

const PIP_W = 200;
const PIP_H = 116;
const PIP_GAP = 14;

function PipDraggable({
  containerRef,
  children,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startMouseX: 0, startMouseY: 0, startX: 0, startY: 0 });

  const snap = (corner: "bl" | "br") => {
    const r = containerRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return corner === "br"
      ? { x: r.width - PIP_W - PIP_GAP, y: r.height - PIP_H - PIP_GAP }
      : { x: PIP_GAP, y: r.height - PIP_H - PIP_GAP };
  };

  useEffect(() => {
    if (pos !== null) return;
    let raf = 0;
    const tryInit = () => {
      const r = containerRef.current?.getBoundingClientRect();
      if (r && r.width > 0 && r.height > 0) setPos(snap("br"));
      else raf = requestAnimationFrame(tryInit);
    };
    tryInit();
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]);

  useEffect(() => {
    const onResize = () => {
      const r = containerRef.current?.getBoundingClientRect();
      if (!r || !pos) return;
      const corner: "bl" | "br" = pos.x + PIP_W / 2 < r.width / 2 ? "bl" : "br";
      setPos(snap(corner));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pos) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: pos.x,
      startY: pos.y,
    };
    setIsDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragRef.current.startMouseX;
    const dy = e.clientY - dragRef.current.startMouseY;
    setPos({
      x: dragRef.current.startX + dx,
      y: dragRef.current.startY + dy,
    });
  };

  const onPointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const r = containerRef.current?.getBoundingClientRect();
    if (!r || !pos) return;
    const corner: "bl" | "br" = pos.x + PIP_W / 2 < r.width / 2 ? "bl" : "br";
    setPos(snap(corner));
  };

  if (!pos) return null;

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        width: PIP_W,
        height: PIP_H,
        zIndex: 20,
        cursor: isDragging ? "grabbing" : "grab",
        touchAction: "none",
        transition: isDragging
          ? "none"
          : "left 0.42s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.42s cubic-bezier(0.34, 1.56, 0.64, 1)",
        borderRadius: 12,
        overflow: "hidden",
        background: T.videoBg,
        boxShadow: `0 8px 24px rgba(15, 23, 42, 0.35), 0 0 0 2px ${T.surface}`,
      }}
    >
      {children}
    </div>
  );
}
