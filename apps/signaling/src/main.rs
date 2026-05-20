mod auth;
mod conversations;
mod db;
mod matching;
mod protocol;
mod realtime;
mod rooms;
mod turn;
mod usage;
mod ws;

use std::net::SocketAddr;
use std::sync::Arc;

use axum::routing::{get, post};
use axum::Router;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::EnvFilter;

use crate::auth::FirebaseAuth;
use crate::db::Db;
use crate::matching::{Matcher, PeerRegistry};
use crate::realtime::RealtimeConfig;
use crate::rooms::Rooms;
use crate::turn::TurnConfig;
use crate::usage::UsageStore;

#[derive(Clone)]
pub struct AppState {
    pub rooms: Arc<Rooms>,
    pub matcher: Arc<Matcher>,
    pub peers: Arc<PeerRegistry>,
    pub turn: Arc<TurnConfig>,
    pub realtime: Arc<RealtimeConfig>,
    pub db: Db,
    pub auth: FirebaseAuth,
    pub usage: UsageStore,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load .env from the crate dir so it works regardless of the shell CWD
    // (e.g. when `cargo run --manifest-path ...` is invoked from monorepo root).
    let _ = dotenvy::from_filename(concat!(env!("CARGO_MANIFEST_DIR"), "/.env"));

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

    let realtime_cfg = RealtimeConfig::from_env();
    if realtime_cfg.is_configured() {
        tracing::info!(model = %realtime_cfg.model, "Realtime API enabled");
    } else {
        tracing::warn!("Realtime API disabled: OPENAI_API_KEY not set");
    }

    let db_path = std::env::var("HITHERE_DB_PATH")
        .unwrap_or_else(|_| concat!(env!("CARGO_MANIFEST_DIR"), "/hithere.db").to_string());
    let db = db::connect(&db_path).await?;
    tracing::info!(%db_path, "sqlite connected");

    // Default to the web app's project so local dev verifies the same audience.
    if std::env::var("FIREBASE_PROJECT_ID").is_err() {
        std::env::set_var("FIREBASE_PROJECT_ID", "hitheer-app");
    }
    let firebase = FirebaseAuth::from_env();
    if firebase.enabled() {
        tracing::info!("Firebase ID token verification enabled");
    } else {
        tracing::warn!("Firebase verification disabled (FIREBASE_PROJECT_ID not set); accepting anonymous peers");
    }

    let usage = UsageStore::new(db.clone());
    let state = AppState {
        rooms: Rooms::new(),
        matcher: Arc::new(matcher),
        peers: Arc::new(PeerRegistry::default()),
        turn: Arc::new(turn_cfg),
        realtime: Arc::new(realtime_cfg),
        db,
        auth: firebase,
        usage,
    };

    let app = Router::new()
        .route("/healthz", get(|| async { "ok" }))
        .route("/turn-credentials", get(turn::turn_credentials))
        .route("/realtime-session", post(realtime::realtime_session))
        .route(
            "/realtime-session/heartbeat",
            post(realtime::realtime_heartbeat),
        )
        .route("/realtime-session/close", post(realtime::realtime_close))
        .route("/usage/today", get(realtime::usage_today))
        .route("/retranslate", post(realtime::retranslate))
        .route("/conversations", post(conversations::save).get(conversations::list))
        .route("/conversations/:id", get(conversations::detail))
        .route("/ws", get(ws::ws_handler))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(state);

    // Cloud Run injects PORT; locally fall back to 8787.
    let host = std::env::var("HITHERE_BIND_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port = std::env::var("PORT")
        .or_else(|_| std::env::var("HITHERE_BIND_PORT"))
        .unwrap_or_else(|_| "8787".to_string());
    let addr: SocketAddr = format!("{host}:{port}").parse()?;
    tracing::info!(%addr, "signaling server listening");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
