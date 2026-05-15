#!/usr/bin/env bash
# Renders infra/coturn/turnserver.conf.rendered from the template using env vars.
# Usage:
#   EXTERNAL_IP=192.168.1.42 STATIC_AUTH_SECRET=$(openssl rand -hex 32) REALM=hithere.local \
#     ./infra/render-coturn.sh
set -euo pipefail

: "${EXTERNAL_IP:?EXTERNAL_IP is required (host LAN IP for local dev)}"
: "${STATIC_AUTH_SECRET:?STATIC_AUTH_SECRET is required (must match signaling server)}"
: "${REALM:=hithere.local}"

DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$DIR/coturn/turnserver.conf"
DST="$DIR/coturn/turnserver.conf.rendered"

sed \
  -e "s|\${EXTERNAL_IP}|$EXTERNAL_IP|g" \
  -e "s|\${STATIC_AUTH_SECRET}|$STATIC_AUTH_SECRET|g" \
  -e "s|\${REALM}|$REALM|g" \
  "$SRC" >"$DST"

echo "Wrote $DST"
echo "Signaling env:"
echo "  TURN_STATIC_AUTH_SECRET=$STATIC_AUTH_SECRET"
echo "  TURN_URIS=turn:$EXTERNAL_IP:3478?transport=udp,turn:$EXTERNAL_IP:3478?transport=tcp"
