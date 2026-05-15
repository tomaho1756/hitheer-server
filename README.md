# hithere

Random language-exchange video calling. WebRTC 1:1 + matching by language preference + live translated subtitles.

## Stack
- `apps/web` — Next.js client
- `apps/signaling` — Rust axum WebSocket signaling + matching
- `apps/api` — Nest.js REST API (Sprint 6)
- `packages/shared` — shared TS event schema

## Run locally
```bash
pnpm install
pnpm dev:signaling   # terminal 1 — Rust axum on :8787
pnpm dev:web         # terminal 2 — Next.js on :3100
```

Open `http://localhost:3100/` in two tabs, click **Match** in each, and they pair into a call.

For dev/debug: `http://localhost:3100/call/<any-room-id>` in two tabs forces them into the same room without matchmaking.

> ⚠️ Cross-device note: browsers require **secure context** for `getUserMedia` on non-localhost origins. Either (a) test both tabs on the same machine via `localhost`, or (b) for two-device testing run web behind HTTPS (`mkcert` + `next dev --experimental-https`) **or** add the LAN IP to Chrome's `chrome://flags/#unsafely-treat-insecure-origin-as-secure` allowlist.

## TURN (Sprint 2)

The signaling server exposes `GET /turn-credentials` that signs short-lived coturn REST API credentials. Disabled until you set `TURN_STATIC_AUTH_SECRET`.

### macOS (recommended for local dev)
```bash
brew install coturn
EXTERNAL_IP=$(ipconfig getifaddr en0) \
  STATIC_AUTH_SECRET=$(openssl rand -hex 32) \
  REALM=hithere.local \
  ./infra/render-coturn.sh
turnserver -c infra/coturn/turnserver.conf.rendered
```
The render script prints the env vars to set for the signaling server:
```bash
TURN_STATIC_AUTH_SECRET=... TURN_URIS=turn:LAN_IP:3478?transport=udp,... pnpm dev:signaling
```

### Linux / Docker
```bash
EXTERNAL_IP=<public-ip> STATIC_AUTH_SECRET=... REALM=hithere.local ./infra/render-coturn.sh
docker compose -f infra/docker-compose.yml up coturn
```

### Verify
- `curl http://localhost:8787/turn-credentials` returns username/password/uris.
- In Chrome `chrome://webrtc-internals`, after a match you should see at least one ICE candidate of type `relay` when both peers are on different networks.
