// Per-user daily translation usage tracking.
//
// Two pieces of state:
//   1. SQLite table `user_usage(uid, day, seconds_used, plan_at_time)` — persistent
//      counter that resets implicitly at midnight UTC (new row per day).
//   2. In-memory `ActiveSessions` map (session_id -> info) — tracks open Realtime
//      sessions so /heartbeat can charge time since the previous heartbeat with
//      a sane upper bound on delta (anti-cheat).
//
// We bill *only while the user has an open session*, which means:
//   - When the user toggles translation off on the client, they stop heartbeating
//     and we stop charging — exactly the behaviour the user asked for.
//   - If the client crashes, the heartbeat just stops; no further charges accrue.
//   - If the client lies about session_id, the worst they get is an extra
//     `MAX_HEARTBEAT_DELTA_SECS` of bill leakage before we cap it.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use rand::distributions::Alphanumeric;
use rand::Rng;
use tokio::sync::RwLock;

use crate::auth::Plan;
use crate::db::Db;

// Heartbeats from the client should arrive every ~15s. Cap the delta we charge
// per heartbeat to 30s so a frozen client (or a forged heartbeat skipping
// minutes) can never burn more than a few seconds of slack.
const MAX_HEARTBEAT_DELTA_SECS: i64 = 30;

#[derive(Clone)]
pub struct UsageStore {
    db: Db,
    active: Arc<RwLock<HashMap<String, ActiveSession>>>,
}

#[derive(Clone, Debug)]
struct ActiveSession {
    uid: String,
    plan: Plan,
    last_tick_unix: i64,
    started_unix: i64,
}

#[derive(Debug, Clone, Copy)]
pub struct UsageSummary {
    pub used_seconds: i64,
    pub remaining_seconds: Option<i64>, // None = unlimited
}

impl UsageStore {
    pub fn new(db: Db) -> Self {
        Self {
            db,
            active: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Read today's used-seconds for this uid from SQLite.
    pub async fn summary_today(&self, uid: &str, plan: Plan) -> sqlx::Result<UsageSummary> {
        let day = today_utc_str();
        let row: Option<(i64,)> = sqlx::query_as(
            "SELECT seconds_used FROM user_usage WHERE uid = ?1 AND day = ?2",
        )
        .bind(uid)
        .bind(&day)
        .fetch_optional(&self.db)
        .await?;
        let used = row.map(|(v,)| v).unwrap_or(0);
        let remaining = plan.daily_limit_seconds().map(|lim| (lim - used).max(0));
        Ok(UsageSummary {
            used_seconds: used,
            remaining_seconds: remaining,
        })
    }

    /// Open a new tracking session. Returns the session_id.
    pub async fn open_session(&self, uid: &str, plan: Plan) -> String {
        let session_id: String = rand::thread_rng()
            .sample_iter(&Alphanumeric)
            .take(24)
            .map(char::from)
            .collect();
        let now = unix_now();
        let mut map = self.active.write().await;
        map.insert(
            session_id.clone(),
            ActiveSession {
                uid: uid.to_string(),
                plan,
                last_tick_unix: now,
                started_unix: now,
            },
        );
        session_id
    }

    /// Charge a heartbeat tick to the given session. Returns the updated summary
    /// so the client can show remaining time and decide whether to throttle.
    /// Returns `Err` (not found) if the session_id is unknown — typically means
    /// it was already closed.
    pub async fn heartbeat(&self, session_id: &str) -> Result<UsageSummary, HeartbeatErr> {
        let now = unix_now();
        let (uid, plan, delta) = {
            let mut map = self.active.write().await;
            let s = map.get_mut(session_id).ok_or(HeartbeatErr::NotFound)?;
            let mut delta = now - s.last_tick_unix;
            if delta < 0 {
                delta = 0;
            }
            if delta > MAX_HEARTBEAT_DELTA_SECS {
                delta = MAX_HEARTBEAT_DELTA_SECS;
            }
            s.last_tick_unix = now;
            (s.uid.clone(), s.plan, delta)
        };

        if delta > 0 {
            let day = today_utc_str();
            sqlx::query(
                r#"
                INSERT INTO user_usage (uid, day, seconds_used, plan_at_time)
                VALUES (?1, ?2, ?3, ?4)
                ON CONFLICT (uid, day) DO UPDATE SET
                    seconds_used = seconds_used + excluded.seconds_used,
                    plan_at_time = excluded.plan_at_time
                "#,
            )
            .bind(&uid)
            .bind(&day)
            .bind(delta)
            .bind(plan.as_str())
            .execute(&self.db)
            .await
            .map_err(|e| HeartbeatErr::Db(e.to_string()))?;
        }

        self.summary_today(&uid, plan)
            .await
            .map_err(|e| HeartbeatErr::Db(e.to_string()))
    }

    /// Close a session — final heartbeat tick + remove from active map.
    /// Idempotent.
    pub async fn close_session(&self, session_id: &str) {
        let now = unix_now();
        let popped = {
            let mut map = self.active.write().await;
            map.remove(session_id)
        };
        if let Some(s) = popped {
            let mut delta = now - s.last_tick_unix;
            if delta < 0 {
                delta = 0;
            }
            if delta > MAX_HEARTBEAT_DELTA_SECS {
                delta = MAX_HEARTBEAT_DELTA_SECS;
            }
            if delta > 0 {
                let day = today_utc_str();
                let _ = sqlx::query(
                    r#"
                    INSERT INTO user_usage (uid, day, seconds_used, plan_at_time)
                    VALUES (?1, ?2, ?3, ?4)
                    ON CONFLICT (uid, day) DO UPDATE SET
                        seconds_used = seconds_used + excluded.seconds_used,
                        plan_at_time = excluded.plan_at_time
                    "#,
                )
                .bind(&s.uid)
                .bind(&day)
                .bind(delta)
                .bind(s.plan.as_str())
                .execute(&self.db)
                .await;
            }
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum HeartbeatErr {
    #[error("session not found")]
    NotFound,
    #[error("db: {0}")]
    Db(String),
}

fn unix_now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn today_utc_str() -> String {
    // YYYY-MM-DD in UTC. Uses chrono for stability across the date boundary.
    chrono::Utc::now().format("%Y-%m-%d").to_string()
}
