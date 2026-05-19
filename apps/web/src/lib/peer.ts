import type { IceCandidatePayload } from "./protocol";

interface TurnCredentials {
  username: string;
  password: string;
  ttl: number;
  uris: string[];
}

const DEFAULT_STUN: RTCIceServer = { urls: "stun:stun.l.google.com:19302" };

export async function fetchIceServers(): Promise<RTCIceServer[]> {
  const servers: RTCIceServer[] = [DEFAULT_STUN];
  try {
    const base = process.env.NEXT_PUBLIC_SIGNALING_HTTP ??
      (typeof window !== "undefined" ? window.location.origin : "");
    const res = await fetch(`${base}/turn-credentials`, {
      headers: { "ngrok-skip-browser-warning": "1" },
    });
    if (res.ok) {
      const creds = (await res.json()) as TurnCredentials;
      if (creds.uris?.length) {
        servers.push({
          urls: creds.uris,
          username: creds.username,
          credential: creds.password,
        });
      }
    }
  } catch (err) {
    console.warn("TURN fetch failed, falling back to STUN only", err);
  }
  return servers;
}

export interface PeerHooks {
  onLocalIce: (candidate: IceCandidatePayload) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionState: (state: RTCPeerConnectionState) => void;
  onIceState: (state: RTCIceConnectionState) => void;
  onNegotiationNeeded: () => void;
}

export function createPeerConnection(
  iceServers: RTCIceServer[],
  hooks: PeerHooks
): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers });

  pc.onicecandidate = (e) => {
    if (!e.candidate) return;
    hooks.onLocalIce({
      candidate: e.candidate.candidate,
      sdpMid: e.candidate.sdpMid,
      sdpMLineIndex: e.candidate.sdpMLineIndex,
    });
  };

  pc.ontrack = (e) => hooks.onRemoteStream(e.streams[0]);
  pc.onconnectionstatechange = () => hooks.onConnectionState(pc.connectionState);
  pc.oniceconnectionstatechange = () => hooks.onIceState(pc.iceConnectionState);
  pc.onnegotiationneeded = () => hooks.onNegotiationNeeded();

  return pc;
}

export interface LocalMediaResult {
  stream: MediaStream;
  hasVideo: boolean;
  hasAudio: boolean;
  note?: string; // for UI when something fell back / failed
}

/// Acquire mic + cam only (no PC). Used by the lobby to preview the user's
/// setup before the actual call starts. Try video+audio → audio-only → fail.
export async function acquireLocalMedia(opts: {
  audioDeviceId?: string;
  videoDeviceId?: string;
} = {}): Promise<LocalMediaResult> {
  const audioConstraints: MediaTrackConstraints = {
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true,
    ...(opts.audioDeviceId ? { deviceId: { exact: opts.audioDeviceId } } : {}),
  };
  const videoConstraints: MediaTrackConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    ...(opts.videoDeviceId ? { deviceId: { exact: opts.videoDeviceId } } : {}),
  };

  const tryGet = (c: MediaStreamConstraints) => navigator.mediaDevices.getUserMedia(c);

  let stream: MediaStream;
  let note: string | undefined;
  try {
    stream = await tryGet({ video: videoConstraints, audio: audioConstraints });
  } catch (e) {
    const err = e as DOMException;
    note = `camera unavailable (${err.name}); trying audio only`;
    console.warn(note, err);
    try {
      stream = await tryGet({ video: false, audio: audioConstraints });
      note = "running in audio-only mode";
    } catch (e2) {
      const err2 = e2 as DOMException;
      throw new Error(`microphone unavailable: ${err2.name}`);
    }
  }
  return {
    stream,
    hasVideo: stream.getVideoTracks().length > 0,
    hasAudio: stream.getAudioTracks().length > 0,
    note,
  };
}

/// Add existing local tracks to a peer connection.
export function attachStreamToPc(pc: RTCPeerConnection, stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    pc.addTrack(track, stream);
  }
}

/// Combined: acquire + attach. Kept for compat with the older call flow.
export async function attachLocalMedia(pc: RTCPeerConnection): Promise<LocalMediaResult> {
  const result = await acquireLocalMedia();
  attachStreamToPc(pc, result.stream);
  return result;
}

export function setTrackEnabled(stream: MediaStream | null, kind: "audio" | "video", enabled: boolean) {
  if (!stream) return;
  const tracks = kind === "audio" ? stream.getAudioTracks() : stream.getVideoTracks();
  for (const t of tracks) t.enabled = enabled;
}
