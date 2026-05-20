"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { acquireLocalMedia, setTrackEnabled } from "@/lib/peer";
import { loadGlossary, saveGlossary } from "@/lib/glossary";
import type { GlossaryEntry } from "@/lib/realtime";

const ACCENT = "#03C75A";
const ACCENT_DEEP = "#02a949";
const ACCENT_SOFT = "#e8f8ee";
const BORDER = "#e5e7eb";
const SURFACE = "#ffffff";
const SURFACE_ALT = "#f1f3f5";
const TEXT = "#18191a";
const TEXT_MUTED = "#65676b";
const PAGE_BG = "#f7f8fa";
const DANGER = "#f02849";

export interface LobbyResult {
  stream: MediaStream;
  micOn: boolean;
  camOn: boolean;
  audioDeviceId?: string;
  videoDeviceId?: string;
}

interface LobbyProps {
  mySpeaks: string;
  partnerSpeaks: string;
  roomId: string;
  isHost: boolean;
  onJoin: (r: LobbyResult) => void;
}

export function Lobby({ mySpeaks, partnerSpeaks, roomId, isHost, onJoin }: LobbyProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transferredRef = useRef(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDeviceId, setAudioDeviceId] = useState<string | undefined>(undefined);
  const [videoDeviceId, setVideoDeviceId] = useState<string | undefined>(undefined);
  const [hasVideo, setHasVideo] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acquiring, setAcquiring] = useState(true);

  // (Re-)acquire media when the chosen device changes.
  useEffect(() => {
    let active = true;
    setAcquiring(true);
    (async () => {
      // Stop any previously acquired stream first.
      const prev = streamRef.current;
      if (prev) {
        prev.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      try {
        const r = await acquireLocalMedia({ audioDeviceId, videoDeviceId });
        if (!active) {
          r.stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = r.stream;
        setHasVideo(r.hasVideo);
        setHasAudio(r.hasAudio);
        // Carry over toggles
        setTrackEnabled(r.stream, "audio", micOn);
        setTrackEnabled(r.stream, "video", camOn);
        if (videoRef.current) videoRef.current.srcObject = r.stream;
        setError(null);

        // Now that we have permission, enumerate devices for the selectors.
        const all = await navigator.mediaDevices.enumerateDevices();
        if (!active) return;
        setAudioDevices(all.filter((d) => d.kind === "audioinput"));
        setVideoDevices(all.filter((d) => d.kind === "videoinput"));
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setAcquiring(false);
      }
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioDeviceId, videoDeviceId]);

  // Clean up the stream on unmount IF the user navigated away without joining.
  useEffect(() => {
    return () => {
      if (!transferredRef.current && streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const toggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    setTrackEnabled(streamRef.current, "audio", next);
  };
  const toggleCam = () => {
    const next = !camOn;
    setCamOn(next);
    setTrackEnabled(streamRef.current, "video", next);
  };

  const handleJoin = () => {
    if (!streamRef.current) return;
    transferredRef.current = true;
    onJoin({
      stream: streamRef.current,
      micOn,
      camOn,
      audioDeviceId,
      videoDeviceId,
    });
  };

  return (
    <main
      style={{
        background: PAGE_BG,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          background: "rgba(255, 255, 255, 0.85)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          borderBottom: `1px solid ${BORDER}`,
          padding: "12px 24px",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Link
            href="/"
            style={{
              color: TEXT_MUTED,
              fontSize: 13,
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            ← 홈으로
          </Link>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: TEXT_MUTED,
            }}
          >
            <span style={{ fontFamily: "ui-monospace, monospace" }}>
              {roomId.slice(0, 8)}
            </span>
            {mySpeaks && partnerSpeaks && (
              <span
                style={{
                  background: ACCENT_SOFT,
                  color: ACCENT_DEEP,
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontWeight: 700,
                  letterSpacing: 0.3,
                }}
              >
                {mySpeaks.toUpperCase()} → {partnerSpeaks.toUpperCase()}
              </span>
            )}
            <span
              style={{
                background: SURFACE_ALT,
                padding: "2px 8px",
                borderRadius: 999,
                fontWeight: 600,
              }}
            >
              {isHost ? "방 주최자" : "참가자"}
            </span>
          </div>
        </div>
      </header>

      <section
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 16px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 540,
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 18,
            padding: 24,
            boxShadow: "0 6px 22px rgba(15,23,42,0.07), 0 1px 3px rgba(15,23,42,0.04)",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: -0.4,
              color: TEXT,
              textAlign: "center",
            }}
          >
            마이크와 카메라를 확인하세요
          </h1>
          <p
            style={{
              margin: "6px 0 22px",
              color: TEXT_MUTED,
              fontSize: 13,
              textAlign: "center",
            }}
          >
            준비되면 통화에 입장하세요. 들어간 뒤에도 끄고 켤 수 있어요.
          </p>

          <VideoPreview
            videoRef={videoRef}
            hasVideo={hasVideo}
            camOn={camOn}
            acquiring={acquiring}
            error={error}
          />

          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "center",
              marginTop: 14,
            }}
          >
            <RoundToggle
              on={micOn}
              onClick={toggleMic}
              disabled={!hasAudio || acquiring}
              onIcon={MicIcon}
              offIcon={MicOffIcon}
              labelOn="마이크 켜짐"
              labelOff="마이크 꺼짐"
            />
            <RoundToggle
              on={camOn}
              onClick={toggleCam}
              disabled={!hasVideo || acquiring}
              onIcon={CamIcon}
              offIcon={CamOffIcon}
              labelOn="카메라 켜짐"
              labelOff="카메라 꺼짐"
            />
          </div>

          <DeviceSelector
            label="마이크"
            devices={audioDevices}
            value={audioDeviceId}
            onChange={setAudioDeviceId}
            disabled={acquiring}
          />
          <DeviceSelector
            label="카메라"
            devices={videoDevices}
            value={videoDeviceId}
            onChange={setVideoDeviceId}
            disabled={acquiring || !hasVideo}
          />

          <GlossarySection />

          {error && (
            <div
              style={{
                marginTop: 14,
                padding: "10px 12px",
                background: "#fef2f2",
                border: `1px solid #fecaca`,
                borderRadius: 8,
                color: "#991b1b",
                fontSize: 12.5,
              }}
            >
              {error}
            </div>
          )}

          <button
            onClick={handleJoin}
            disabled={acquiring || (!hasAudio && !hasVideo)}
            style={{
              marginTop: 22,
              width: "100%",
              padding: "13px 18px",
              background:
                acquiring || (!hasAudio && !hasVideo) ? SURFACE_ALT : ACCENT,
              color:
                acquiring || (!hasAudio && !hasVideo) ? "#9ca3af" : "white",
              border: `1px solid ${
                acquiring || (!hasAudio && !hasVideo) ? BORDER : ACCENT
              }`,
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 700,
              cursor:
                acquiring || (!hasAudio && !hasVideo) ? "not-allowed" : "pointer",
              boxShadow:
                acquiring || (!hasAudio && !hasVideo)
                  ? "none"
                  : `0 4px 14px ${ACCENT}50`,
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled)
                e.currentTarget.style.background = ACCENT_DEEP;
            }}
            onMouseLeave={(e) => {
              if (!e.currentTarget.disabled)
                e.currentTarget.style.background = ACCENT;
            }}
          >
            {acquiring ? "준비 중…" : "통화 입장하기"}
          </button>
        </div>
      </section>
    </main>
  );
}

function VideoPreview({
  videoRef,
  hasVideo,
  camOn,
  acquiring,
  error,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  hasVideo: boolean;
  camOn: boolean;
  acquiring: boolean;
  error: string | null;
}) {
  const showPlaceholder = !hasVideo || !camOn || acquiring || !!error;
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16/9",
        background: "#0a0c10",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: showPlaceholder ? "none" : "block",
          transform: "scaleX(-1)",
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
            color: "rgba(255,255,255,0.75)",
          }}
        >
          {acquiring ? (
            <Spinner />
          ) : (
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CamOffIcon size={28} />
            </div>
          )}
          <span style={{ fontSize: 12 }}>
            {acquiring
              ? "디바이스 준비 중…"
              : error
              ? "권한 거부됨"
              : !hasVideo
              ? "카메라 없음"
              : "카메라 꺼짐"}
          </span>
        </div>
      )}
    </div>
  );
}

function DeviceSelector({
  label,
  devices,
  value,
  onChange,
  disabled,
}: {
  label: string;
  devices: MediaDeviceInfo[];
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ marginTop: 14 }}>
      <label
        style={{
          display: "block",
          fontSize: 11,
          color: TEXT_MUTED,
          fontWeight: 700,
          letterSpacing: 0.5,
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        disabled={disabled || devices.length === 0}
        style={{
          width: "100%",
          padding: "9px 11px",
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 8,
          fontSize: 13,
          color: TEXT,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {devices.length === 0 && <option value="">없음</option>}
        {devices.length > 0 && <option value="">기본 디바이스</option>}
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || `${label} ${d.deviceId.slice(0, 6)}`}
          </option>
        ))}
      </select>
    </div>
  );
}

function RoundToggle({
  on,
  onClick,
  disabled,
  onIcon: OnIcon,
  offIcon: OffIcon,
  labelOn,
  labelOff,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
  onIcon: (p: { size?: number }) => React.JSX.Element;
  offIcon: (p: { size?: number }) => React.JSX.Element;
  labelOn: string;
  labelOff: string;
}) {
  const bg = disabled ? SURFACE_ALT : on ? SURFACE_ALT : DANGER;
  const color = disabled ? "#9ca3af" : on ? TEXT : "white";
  const border = disabled
    ? BORDER
    : on
    ? BORDER
    : "#b91c1c";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={on ? labelOn : labelOff}
      style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        background: bg,
        color,
        border: `1px solid ${border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "transform 0.15s, background 0.15s",
        boxShadow: on || disabled ? "none" : `0 2px 8px ${DANGER}55`,
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.transform = "scale(1.06)";
      }}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      {on ? <OnIcon /> : <OffIcon />}
    </button>
  );
}

function Spinner() {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        border: "3px solid rgba(255,255,255,0.2)",
        borderTopColor: "white",
        borderRadius: "50%",
        animation: "lobbyspin 0.9s linear infinite",
      }}
    >
      <style>{`@keyframes lobbyspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function MicIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}
function MicOffIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" x2="22" y1="2" y2="22" />
      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
      <path d="M5 10v2a7 7 0 0 0 12 5" />
      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}
function CamIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 8-6 4 6 4V8Z" />
      <rect width="14" height="12" x="2" y="6" rx="2" />
    </svg>
  );
}
function CamOffIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.66 6H14a2 2 0 0 1 2 2v2.34l1 1L22 8v8" />
      <path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2l10 10Z" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

function GlossarySection() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<GlossaryEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setEntries(loadGlossary());
    setHydrated(true);
  }, []);

  const commit = (next: GlossaryEntry[]) => {
    setEntries(next);
    saveGlossary(next);
  };

  const addRow = () => commit([...entries, { term: "", translation: "" }]);
  const removeRow = (i: number) =>
    commit(entries.filter((_, idx) => idx !== i));
  const updateRow = (i: number, patch: Partial<GlossaryEntry>) =>
    commit(entries.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      style={{
        marginTop: 18,
        padding: "10px 12px",
        background: SURFACE_ALT,
        borderRadius: 12,
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          listStyle: "none",
          fontSize: 13,
          fontWeight: 700,
          color: TEXT,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>
          용어집{" "}
          <span style={{ color: TEXT_MUTED, fontWeight: 500 }}>
            (선택 · {entries.filter((e) => e.term.trim()).length}개)
          </span>
        </span>
        <span style={{ color: TEXT_MUTED, fontSize: 12 }}>
          {open ? "▾" : "▸"}
        </span>
      </summary>
      <p
        style={{
          margin: "8px 0 10px",
          fontSize: 11.5,
          color: TEXT_MUTED,
          lineHeight: 1.5,
        }}
      >
        고유명사 · 회사명 · 약어처럼 자동 번역을 막고 싶은 단어를 등록하세요.
        번역을 비워두면 원문 그대로 유지합니다.
      </p>
      {hydrated &&
        entries.map((e, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr auto",
              gap: 6,
              marginBottom: 6,
            }}
          >
            <input
              value={e.term}
              onChange={(ev) => updateRow(i, { term: ev.target.value })}
              placeholder="단어"
              style={glossaryInput}
            />
            <input
              value={e.translation ?? ""}
              onChange={(ev) => updateRow(i, { translation: ev.target.value })}
              placeholder="번역 (선택)"
              style={glossaryInput}
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              style={{
                padding: "0 10px",
                background: "transparent",
                color: DANGER,
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 14,
                fontFamily: "inherit",
              }}
              aria-label="제거"
            >
              ×
            </button>
          </div>
        ))}
      <button
        type="button"
        onClick={addRow}
        style={{
          marginTop: 6,
          padding: "7px 12px",
          background: SURFACE,
          color: TEXT,
          border: `1px dashed ${BORDER}`,
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        + 단어 추가
      </button>
    </details>
  );
}

const glossaryInput: React.CSSProperties = {
  padding: "7px 10px",
  background: SURFACE,
  color: TEXT,
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  fontSize: 12.5,
  fontFamily: "inherit",
  outline: "none",
};
