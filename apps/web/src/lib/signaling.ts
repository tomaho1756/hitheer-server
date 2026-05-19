import type { ClientToServer, ServerToClient } from "./protocol";

export type SignalingHandler = (msg: ServerToClient) => void;

export class SignalingClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handler: SignalingHandler;

  constructor(url: string, handler: SignalingHandler) {
    this.url = url;
    this.handler = handler;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.onopen = () => resolve();
      ws.onerror = (e) => reject(e);
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as ServerToClient;
          this.handler(msg);
        } catch (e) {
          console.warn("invalid server message", ev.data, e);
        }
      };
      ws.onclose = () => {
        this.ws = null;
      };
    });
  }

  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  send(msg: ClientToServer) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      // Dev fast-refresh / effect cleanup race can land here legitimately.
      console.debug("signaling not open, dropped", msg);
    }
  }

  close() {
    if (!this.ws) return;
    // Detach handlers so a CONNECTING socket doesn't emit a "closed before established"
    // error in the console when we abort it.
    this.ws.onopen = null;
    this.ws.onmessage = null;
    this.ws.onerror = null;
    this.ws.onclose = null;
    try {
      this.ws.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
  }
}

export function signalingUrl(token?: string | null): string {
  if (typeof window === "undefined") return "";
  const env = process.env.NEXT_PUBLIC_SIGNALING_URL;
  const base = env
    ? env
    : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;
  if (!token) return base;
  return base + (base.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(token);
}
