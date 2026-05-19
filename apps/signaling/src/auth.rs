// Firebase ID-token verification.
//
// Firebase signs ID tokens with rotating RS256 keys. The public certs are
// served as a JSON map `{ kid: pem }` at the Google securetoken URL below and
// rotate roughly daily. We cache the cert set and refresh on cache miss /
// expiry.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use tokio::sync::RwLock;

const CERTS_URL: &str = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const REFRESH_AFTER: Duration = Duration::from_secs(60 * 30); // 30 minutes

#[derive(Clone)]
pub struct FirebaseAuth {
    project_id: String,
    inner: Arc<RwLock<CertCache>>,
    enabled: bool,
}

#[derive(Default)]
struct CertCache {
    keys: HashMap<String, DecodingKey>,
    fetched_at: Option<Instant>,
}

#[derive(Debug, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub aud: String,
    pub iss: String,
    pub email: Option<String>,
    pub name: Option<String>,
    pub picture: Option<String>,
    pub exp: usize,
}

#[derive(Debug, Clone)]
pub struct VerifiedUser {
    pub uid: String,
    pub email: Option<String>,
    pub name: Option<String>,
}

impl FirebaseAuth {
    pub fn from_env() -> Self {
        let project_id = std::env::var("FIREBASE_PROJECT_ID").unwrap_or_default();
        Self {
            enabled: !project_id.is_empty(),
            project_id,
            inner: Arc::new(RwLock::new(CertCache::default())),
        }
    }

    pub fn enabled(&self) -> bool {
        self.enabled
    }

    /// Verifies an ID token; returns the authenticated user.
    /// Returns Err if the token is invalid, expired, or auth is disabled.
    pub async fn verify(&self, token: &str) -> Result<VerifiedUser, AuthError> {
        if !self.enabled {
            return Err(AuthError::Disabled);
        }

        let header = decode_header(token).map_err(|e| AuthError::Decode(e.to_string()))?;
        let kid = header.kid.ok_or(AuthError::MissingKid)?;

        // Try cache, then refresh on miss/staleness.
        let key = self.key_for(&kid, false).await?;
        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_audience(&[self.project_id.clone()]);
        validation.set_issuer(&[format!("https://securetoken.google.com/{}", self.project_id)]);

        let data = match decode::<Claims>(token, &key, &validation) {
            Ok(d) => d,
            Err(e) => {
                // Maybe the cached key was stale — refresh once and retry.
                let kind = e.kind().clone();
                let fresh = self.key_for(&kid, true).await?;
                decode::<Claims>(token, &fresh, &validation).map_err(|e2| {
                    AuthError::Verify(format!("first error: {kind:?}; retry: {e2}"))
                })?
            }
        };

        Ok(VerifiedUser {
            uid: data.claims.sub,
            email: data.claims.email,
            name: data.claims.name,
        })
    }

    async fn key_for(&self, kid: &str, force_refresh: bool) -> Result<DecodingKey, AuthError> {
        if !force_refresh {
            let cache = self.inner.read().await;
            if let Some(fetched) = cache.fetched_at {
                if fetched.elapsed() < REFRESH_AFTER {
                    if let Some(k) = cache.keys.get(kid) {
                        return Ok(k.clone());
                    }
                }
            }
        }
        self.refresh().await?;
        let cache = self.inner.read().await;
        cache.keys.get(kid).cloned().ok_or(AuthError::UnknownKid)
    }

    async fn refresh(&self) -> Result<(), AuthError> {
        let resp = reqwest::get(CERTS_URL)
            .await
            .map_err(|e| AuthError::Fetch(e.to_string()))?;
        let map: HashMap<String, String> = resp
            .json()
            .await
            .map_err(|e| AuthError::Fetch(format!("parse: {e}")))?;
        let mut keys = HashMap::with_capacity(map.len());
        for (kid, pem) in map {
            let key = DecodingKey::from_rsa_pem(pem.as_bytes())
                .map_err(|e| AuthError::Fetch(format!("decode key {kid}: {e}")))?;
            keys.insert(kid, key);
        }
        let mut cache = self.inner.write().await;
        cache.keys = keys;
        cache.fetched_at = Some(Instant::now());
        Ok(())
    }
}

#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error("auth disabled")]
    Disabled,
    #[error("token decode failed: {0}")]
    Decode(String),
    #[error("missing kid in token header")]
    MissingKid,
    #[error("unknown kid")]
    UnknownKid,
    #[error("fetch google certs: {0}")]
    Fetch(String),
    #[error("verify: {0}")]
    Verify(String),
}
