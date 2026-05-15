use axum::extract::{Query, State};
use axum::Json;
use base64::Engine;
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha1::Sha1;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct TurnQuery {
    /// Optional caller-supplied identity to embed in the credential username.
    #[serde(default)]
    pub user: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TurnResponse {
    pub username: String,
    pub password: String,
    pub ttl: i64,
    pub uris: Vec<String>,
}

/// Issues a short-lived TURN credential pair following coturn's REST API
/// scheme (use-auth-secret). The username is `<unix_expiry>:<user>` and the
/// password is base64(HMAC-SHA1(secret, username)).
pub async fn turn_credentials(
    State(state): State<AppState>,
    Query(q): Query<TurnQuery>,
) -> Result<Json<TurnResponse>, (axum::http::StatusCode, &'static str)> {
    let cfg = &state.turn;
    // When TURN isn't configured, return a 200 with empty uris so the browser
    // console doesn't flag it. Client treats empty uris as "STUN only".
    if cfg.secret.is_empty() || cfg.uris.is_empty() {
        return Ok(Json(TurnResponse {
            username: String::new(),
            password: String::new(),
            ttl: 0,
            uris: vec![],
        }));
    }

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, "clock"))?
        .as_secs() as i64;
    let expiry = now + cfg.ttl_secs;
    let user_part = q.user.unwrap_or_else(|| "anon".to_string());
    let username = format!("{expiry}:{user_part}");

    let mut mac = Hmac::<Sha1>::new_from_slice(cfg.secret.as_bytes())
        .map_err(|_| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, "hmac"))?;
    mac.update(username.as_bytes());
    let password = base64::engine::general_purpose::STANDARD.encode(mac.finalize().into_bytes());

    Ok(Json(TurnResponse {
        username,
        password,
        ttl: cfg.ttl_secs,
        uris: cfg.uris.clone(),
    }))
}

#[derive(Clone, Debug)]
pub struct TurnConfig {
    pub secret: String,
    pub ttl_secs: i64,
    pub uris: Vec<String>,
}

impl TurnConfig {
    pub fn from_env() -> Self {
        let secret = std::env::var("TURN_STATIC_AUTH_SECRET").unwrap_or_default();
        let ttl_secs = std::env::var("TURN_TTL_SECS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(3600);
        let uris = std::env::var("TURN_URIS")
            .ok()
            .map(|s| s.split(',').map(|x| x.trim().to_string()).filter(|x| !x.is_empty()).collect())
            .unwrap_or_default();
        Self { secret, ttl_secs, uris }
    }
}
