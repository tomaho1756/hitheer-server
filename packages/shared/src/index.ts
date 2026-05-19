// Signaling protocol shared between web client and Rust signaling server.
// Keep this file in sync with apps/signaling/src/protocol.rs (manual mirror).

export interface SubtitlePayload {
  id: string;
  original: string;
  translated: string;
  langOriginal: string;
  langTranslated: string;
  ts: number;
  final: boolean;
}

export type ClientToServer =
  | { type: "find-match"; speaks: string[]; wants: string[]; allowAny?: boolean }
  | { type: "cancel-match" }
  | { type: "join"; roomId: string }
  | { type: "leave" }
  | { type: "offer"; sdp: string }
  | { type: "answer"; sdp: string }
  | { type: "ice-candidate"; candidate: IceCandidatePayload }
  | ({ type: "subtitle" } & SubtitlePayload);

export type ServerToClient =
  | { type: "queued" }
  | {
      type: "match-found";
      roomId: string;
      shouldOffer: boolean;
      mySpeaks: string;
      partnerSpeaks: string;
    }
  | { type: "joined"; roomId: string; peerCount: number; shouldOffer: boolean }
  | { type: "peer-joined" }
  | { type: "peer-left" }
  | { type: "offer"; sdp: string }
  | { type: "answer"; sdp: string }
  | { type: "ice-candidate"; candidate: IceCandidatePayload }
  | ({ type: "subtitle" } & SubtitlePayload)
  | { type: "error"; message: string };

export interface IceCandidatePayload {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}
