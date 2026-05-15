mod matching;
mod protocol;
mod rooms;
mod turn;
mod ws;

use std::net::SocketAddr;
use std::sync::Arc;

use axum::{routing::get, Router};
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::EnvFilter;

use crate::matching::{Matcher, PeerRegistry};
use crate::rooms::Rooms;
use crate::turn::TurnConfig;

#[derive(Clone)]
pub struct AppState {
    pub rooms: Arc<Rooms>,
    pub matcher: Arc<Matcher>,
    pub peers: Arc<PeerRegistry>,
    pub turn: Arc<TurnConfig>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .init();

    let redis_url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
    let matcher = Matcher::connect(&redis_url).await?;
    tracing::info!(%redis_url, "connected to redis");

    let turn_cfg = TurnConfig::from_env();
    if turn_cfg.secret.is_empty() {
        tracing::warn!("TURN disabled: TURN_STATIC_AUTH_SECRET not set");
    } else {
        tracing::info!(uris = ?turn_cfg.uris, ttl = turn_cfg.ttl_secs, "TURN enabled");
    }

    let state = AppState {
        rooms: Rooms::new(),
        matcher: Arc::new(matcher),
        peers: Arc::new(PeerRegistry::default()),
        turn: Arc::new(turn_cfg),
    };

    let app = Router::new()
        .route("/healthz", get(|| async { "ok" }))
        .route("/turn-credentials", get(turn::turn_credentials))
        .route("/ws", get(ws::ws_handler))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(state);

    let addr: SocketAddr = "0.0.0.0:8787".parse()?;
    tracing::info!(%addr, "signaling server listening");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
