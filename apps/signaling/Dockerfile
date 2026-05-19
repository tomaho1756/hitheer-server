# Multi-stage Rust build for the hithere signaling server.
# - builder: compiles a release binary against debian-slim (glibc) so we can
#   keep dynamic OpenSSL/rustls easy without musl pain.
# - runtime: distroless cc image for a small, hardened final image.

ARG RUST_VERSION=1.95

FROM rust:${RUST_VERSION}-slim-bookworm AS builder

# Build deps for sqlx-sqlite + rustls + reqwest TLS.
RUN apt-get update && \
    apt-get install -y --no-install-recommends pkg-config libssl-dev ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy manifests first to leverage Docker layer caching for dependency builds.
COPY apps/signaling/Cargo.toml apps/signaling/Cargo.lock ./
RUN mkdir -p src && echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src target/release/deps/hithere_signaling*

# Now the real sources.
COPY apps/signaling/src ./src
RUN cargo build --release && \
    strip target/release/hithere-signaling

# --- runtime stage ---------------------------------------------------------
FROM gcr.io/distroless/cc-debian12:nonroot

WORKDIR /app
COPY --from=builder /app/target/release/hithere-signaling /app/hithere-signaling

# Cloud Run injects PORT; the server reads HITHERE_BIND_PORT (see main.rs).
ENV HITHERE_BIND_HOST=0.0.0.0
EXPOSE 8787

USER nonroot

ENTRYPOINT ["/app/hithere-signaling"]
