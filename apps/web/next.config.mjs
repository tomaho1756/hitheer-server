import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin tracing to this directory so Next.js doesn't pick the workspace root
  // when both apps/web/pnpm-lock.yaml and ../../pnpm-lock.yaml exist.
  outputFileTracingRoot: __dirname,
  allowedDevOrigins: ["192.168.0.35", "192.168.0.9", "192.168.219.102"],
  async rewrites() {
    return [
      { source: "/ws", destination: "http://127.0.0.1:8787/ws" },
      { source: "/realtime-session", destination: "http://127.0.0.1:8787/realtime-session" },
      { source: "/retranslate", destination: "http://127.0.0.1:8787/retranslate" },
      { source: "/conversations", destination: "http://127.0.0.1:8787/conversations" },
      { source: "/conversations/:path*", destination: "http://127.0.0.1:8787/conversations/:path*" },
      { source: "/turn-credentials", destination: "http://127.0.0.1:8787/turn-credentials" },
      { source: "/healthz", destination: "http://127.0.0.1:8787/healthz" },
    ];
  },
};

export default nextConfig;
