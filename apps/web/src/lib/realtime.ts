/**
 * OpenAI Realtime API client (WebRTC mode).
 *
 * Flow:
 *  1. POST /realtime-session on our signaling server (with Firebase ID token) →
 *     ephemeral { client_secret, model, session_id, plan, remaining_seconds }.
 *  2. Open an RTCPeerConnection to OpenAI, add the user's mic track, attach a data
 *     channel named "oai-events" for control + transcription/translation events.
 *  3. createOffer → POST it as SDP to OpenAI with the ephemeral key.
 *  4. While the data channel is open, send POST /realtime-session/heartbeat every
 *     15s. If the server returns throttle=true (quota exhausted) we self-close
 *     and notify via onQuotaExceeded.
 *  5. On close(): POST /realtime-session/close so the server logs a final tick.
 */

import { getIdToken } from "./auth-context";

export interface RealtimeSubtitleEvent {
  id: string;
  original: string;
  translated: string;
  langOriginal: string;
  langTranslated: string;
  ts: number;
  final: boolean;
}

export interface RealtimeHandle {
  close: () => void;
}

interface SessionResponse {
  model: string;
  client_secret: { value: string };
  session_id: string;
  plan: string;
  remaining_seconds: number | null;
}

export interface QuotaExceededError extends Error {
  code: "quota_exceeded";
}

const HEARTBEAT_INTERVAL_MS = 15_000;

function signalingHttpBase(): string {
  return (
    process.env.NEXT_PUBLIC_SIGNALING_HTTP ??
    (typeof window !== "undefined" ? window.location.origin : "")
  );
}

export interface GlossaryEntry {
  term: string;
  translation?: string;
}

async function fetchSession(
  speakerLang: string,
  partnerLang: string,
  glossary: GlossaryEntry[] | undefined
): Promise<SessionResponse> {
  const idToken = await getIdToken();
  const res = await fetch(`${signalingHttpBase()}/realtime-session`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "ngrok-skip-browser-warning": "1",
      ...(idToken ? { authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({ speakerLang, partnerLang, glossary: glossary ?? [] }),
  });
  if (res.status === 402) {
    const err = new Error("translation_quota_exceeded") as QuotaExceededError;
    err.code = "quota_exceeded";
    throw err;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`realtime-session failed: ${res.status} ${text}`);
  }
  return (await res.json()) as SessionResponse;
}

export interface UsageSummary {
  plan: string;
  used_seconds: number;
  remaining_seconds: number | null;
  daily_limit_seconds: number | null;
}

export async function fetchUsageToday(): Promise<UsageSummary | null> {
  const idToken = await getIdToken();
  if (!idToken) return null;
  try {
    const res = await fetch(`${signalingHttpBase()}/usage/today`, {
      headers: {
        authorization: `Bearer ${idToken}`,
        "ngrok-skip-browser-warning": "1",
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as UsageSummary;
  } catch {
    return null;
  }
}

async function postLifecycle(path: "heartbeat" | "close", session_id: string) {
  if (!session_id) return null;
  try {
    const res = await fetch(`${signalingHttpBase()}/realtime-session/${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "ngrok-skip-browser-warning": "1",
      },
      body: JSON.stringify({ session_id }),
      keepalive: path === "close",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function startRealtime(opts: {
  micStream: MediaStream;
  speakerLang: string;
  partnerLang: string;
  glossary?: GlossaryEntry[];
  onSubtitle: (e: RealtimeSubtitleEvent) => void;
  onError?: (err: Error) => void;
  /** Fired with each heartbeat result so the call UI can show remaining time. */
  onUsage?: (u: { used_seconds: number; remaining_seconds: number | null }) => void;
  /** Fired when the server says we've blown today's quota; UI should turn off translation. */
  onQuotaExceeded?: () => void;
}): Promise<RealtimeHandle> {
  const session = await fetchSession(opts.speakerLang, opts.partnerLang, opts.glossary);
  const ek = session.client_secret.value;
  const sessionId = session.session_id;

  const pc = new RTCPeerConnection();

  // Attach the (shared) mic track to OpenAI as well as the partner peer.
  const audioTrack = opts.micStream.getAudioTracks()[0];
  if (!audioTrack) throw new Error("no audio track to send to realtime");
  pc.addTrack(audioTrack, opts.micStream);

  // We don't actually want OpenAI's audio output, but creating the receiver is harmless.
  pc.addTransceiver("audio", { direction: "sendonly" });

  const dc = pc.createDataChannel("oai-events");

  // Group transcription + response events that belong to the SAME utterance
  // using OpenAI's item_id (input audio item) as the key. Response events are
  // mapped back to their input item via response.previous_item_id captured at
  // response.created.
  interface Bubble {
    id: string;
    original: string;
    translated: string;
    hasTranscription: boolean;
    hasResponse: boolean;
    transcriptionDone: boolean;
    responseDone: boolean;
  }
  const bubbles = new Map<string, Bubble>();
  const responseToInput = new Map<string, string>();
  // Track the most recent user input item so we can correlate response.created
  // events back to it (response.previous_item_id is not reliably populated in GA).
  let lastInputItemId: string | null = null;

  const ensureBubble = (key: string): Bubble => {
    let b = bubbles.get(key);
    if (!b) {
      b = {
        id: `u-${key}`,
        original: "",
        translated: "",
        hasTranscription: false,
        hasResponse: false,
        transcriptionDone: true,
        responseDone: true,
      };
      bubbles.set(key, b);
    }
    return b;
  };

  const emitBubble = (b: Bubble) => {
    if (!b.original && !b.translated) return;
    const final =
      (!b.hasTranscription || b.transcriptionDone) &&
      (!b.hasResponse || b.responseDone) &&
      (b.hasTranscription || b.hasResponse);
    opts.onSubtitle({
      id: b.id,
      original: b.original,
      translated: b.translated,
      langOriginal: opts.speakerLang,
      langTranslated: opts.partnerLang,
      ts: Date.now(),
      final,
    });
  };

  dc.onmessage = (e) => {
    let evt: Record<string, unknown> & { type?: string };
    try {
      evt = JSON.parse(e.data);
    } catch {
      return;
    }
    switch (evt.type) {
      case "input_audio_buffer.committed": {
        const itemId = evt.item_id as string | undefined;
        if (itemId) lastInputItemId = itemId;
        break;
      }
      case "conversation.item.input_audio_transcription.delta": {
        const itemId = evt.item_id as string | undefined;
        const delta = evt.delta as string | undefined;
        if (!itemId || !delta) return;
        lastInputItemId = itemId;
        const b = ensureBubble(itemId);
        b.hasTranscription = true;
        b.transcriptionDone = false;
        b.original += delta;
        emitBubble(b);
        break;
      }
      case "conversation.item.input_audio_transcription.completed": {
        const itemId = evt.item_id as string | undefined;
        const transcript = evt.transcript as string | undefined;
        if (!itemId) return;
        lastInputItemId = itemId;
        const b = ensureBubble(itemId);
        b.hasTranscription = true;
        if (typeof transcript === "string" && transcript) b.original = transcript;
        b.transcriptionDone = true;
        emitBubble(b);
        break;
      }
      case "response.created": {
        const resp = evt.response as
          | { id?: string; previous_item_id?: string }
          | undefined;
        if (!resp?.id) return;
        // Prefer the explicit linkage if OpenAI sends it; otherwise fall back
        // to the most recent input item we've seen.
        const key = resp.previous_item_id ?? lastInputItemId ?? `resp-${resp.id}`;
        responseToInput.set(resp.id, key);
        const b = ensureBubble(key);
        b.hasResponse = true;
        b.responseDone = false;
        break;
      }
      case "response.text.delta":
      case "response.output_text.delta": {
        const respId = evt.response_id as string | undefined;
        const delta = evt.delta as string | undefined;
        if (!respId || !delta) return;
        const key = responseToInput.get(respId) ?? `resp-${respId}`;
        const b = ensureBubble(key);
        b.hasResponse = true;
        b.responseDone = false;
        b.translated += delta;
        emitBubble(b);
        break;
      }
      case "response.text.done":
      case "response.output_text.done": {
        const respId = evt.response_id as string | undefined;
        const text = evt.text as string | undefined;
        if (!respId) return;
        const key = responseToInput.get(respId) ?? `resp-${respId}`;
        const b = ensureBubble(key);
        if (typeof text === "string" && text) b.translated = text;
        b.responseDone = true;
        emitBubble(b);
        break;
      }
      case "response.done": {
        const resp = evt.response as { id?: string } | undefined;
        if (!resp?.id) return;
        const key = responseToInput.get(resp.id);
        if (!key) return;
        const b = bubbles.get(key);
        if (!b) return;
        b.responseDone = true;
        emitBubble(b);
        break;
      }
      case "error":
        opts.onError?.(new Error(`realtime error: ${JSON.stringify(evt)}`));
        break;
    }
  };
  dc.onopen = () => console.log("[realtime] data channel open");
  dc.onclose = () => console.log("[realtime] data channel closed");
  dc.onerror = (e) => console.log("[realtime] data channel error", e);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // GA endpoint: model is implicit from the ephemeral key's session config.
  const sdpResp = await fetch(`https://api.openai.com/v1/realtime/calls`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ek}`,
      "Content-Type": "application/sdp",
    },
    body: offer.sdp ?? "",
  });
  if (!sdpResp.ok) {
    const text = await sdpResp.text().catch(() => "");
    throw new Error(`realtime SDP exchange failed: ${sdpResp.status} ${text}`);
  }
  const answer = await sdpResp.text();
  await pc.setRemoteDescription({ type: "answer", sdp: answer });

  // Heartbeat: charge usage every 15s while translation is active.
  let closed = false;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  const stopHeartbeat = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  const doClose = () => {
    if (closed) return;
    closed = true;
    stopHeartbeat();
    if (sessionId) {
      // Fire-and-forget — keepalive ensures the request survives page unload.
      void postLifecycle("close", sessionId);
    }
    try {
      dc.close();
    } catch {}
    pc.getSenders().forEach((s) => {
      if (s.track && s.track !== audioTrack) s.track.stop();
    });
    pc.close();
  };

  if (sessionId) {
    heartbeatTimer = setInterval(async () => {
      const result = (await postLifecycle("heartbeat", sessionId)) as
        | {
            used_seconds: number;
            remaining_seconds: number | null;
            throttle: boolean;
          }
        | null;
      if (!result) return;
      opts.onUsage?.({
        used_seconds: result.used_seconds,
        remaining_seconds: result.remaining_seconds,
      });
      if (result.throttle) {
        opts.onQuotaExceeded?.();
        doClose();
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  // Emit initial usage so UI has values immediately.
  opts.onUsage?.({
    used_seconds: 0,
    remaining_seconds: session.remaining_seconds,
  });

  return { close: doClose };
}
