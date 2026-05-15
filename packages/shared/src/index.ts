// Signaling protocol shared between web client and Rust signaling server.
// Keep this file in sync with apps/signaling/src/protocol.rs (manual mirror).

export type ClientToServer =
  | { type: "find-match"; speaks: string[]; wants: string[]; allowAny?: boolean }
  | { type: "cancel-match" }
  | { type: "join"; roomId: string }
  | { type: "leave" }
  | { type: "offer"; sdp: string }
  | { type: "answer"; sdp: string }
  | { type: "ice-candidate"; candidate: IceCandidatePayload };

export type ServerToClient =
  | { type: "queued" }
  | { type: "match-found"; roomId: string; shouldOffer: boolean }
  | { type: "joined"; roomId: string; peerCount: number; shouldOffer: boolean }
  | { type: "peer-joined" }
  | { type: "peer-left" }
  | { type: "offer"; sdp: string }
  | { type: "answer"; sdp: string }
  | { type: "ice-candidate"; candidate: IceCandidatePayload }
  | { type: "error"; message: string };

export interface IceCandidatePayload {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}
