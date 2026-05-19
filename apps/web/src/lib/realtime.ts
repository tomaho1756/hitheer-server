/**
 * OpenAI Realtime API client (WebRTC mode).
 *
 * Flow:
 *  1. POST /realtime-session on our signaling server → ephemeral { client_secret, model }.
 *  2. Open an RTCPeerConnection to OpenAI, add the user's mic track, attach a data channel
 *     named "oai-events" for control + transcription/translation events.
 *  3. createOffer → POST it as SDP to https://api.openai.com/v1/realtime?model=... with the
 *     ephemeral key in Authorization → set the returned SDP as remote answer.
 *  4. Forward each completed transcription / translation pair to the caller.
 */

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
}

function signalingHttpBase(): string {
  return (
    process.env.NEXT_PUBLIC_SIGNALING_HTTP ??
    (typeof window !== "undefined" ? window.location.origin : "")
  );
}

async function fetchSession(speakerLang: string, partnerLang: string): Promise<SessionResponse> {
  const res = await fetch(`${signalingHttpBase()}/realtime-session`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "ngrok-skip-browser-warning": "1",
    },
    body: JSON.stringify({ speakerLang, partnerLang }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`realtime-session failed: ${res.status} ${text}`);
  }
  return (await res.json()) as SessionResponse;
}

export async function startRealtime(opts: {
  micStream: MediaStream;
  speakerLang: string;
  partnerLang: string;
  onSubtitle: (e: RealtimeSubtitleEvent) => void;
  onError?: (err: Error) => void;
}): Promise<RealtimeHandle> {
  const session = await fetchSession(opts.speakerLang, opts.partnerLang);
  const ek = session.client_secret.value;

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

  return {
    close: () => {
      try {
        dc.close();
      } catch {}
      pc.getSenders().forEach((s) => {
        // Don't stop the shared mic track here — the call page owns its lifecycle.
        if (s.track && s.track !== audioTrack) s.track.stop();
      });
      pc.close();
    },
  };
}
