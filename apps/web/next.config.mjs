/** @type {import('next').NextConfig} */
const nextConfig = {
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
