use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct SaveMessage {
    pub who: String,
    pub original: String,
    pub translated: String,
    #[serde(rename = "langOriginal")]
    pub lang_original: String,
    #[serde(rename = "langTranslated")]
    pub lang_translated: String,
    pub ts: i64,
}

#[derive(Debug, Deserialize)]
pub struct SaveConversation {
    #[serde(rename = "clientId")]
    pub client_id: String,
    #[serde(rename = "roomId")]
    pub room_id: String,
    #[serde(rename = "speakerLang")]
    pub speaker_lang: String,
    #[serde(rename = "partnerLang")]
    pub partner_lang: String,
    #[serde(rename = "startedAt")]
    pub started_at: i64,
    #[serde(rename = "endedAt")]
    pub ended_at: i64,
    pub messages: Vec<SaveMessage>,
}

#[derive(Debug, Serialize)]
pub struct SaveResponse {
    pub id: String,
}

pub async fn save(
    State(state): State<AppState>,
    Json(req): Json<SaveConversation>,
) -> Result<Json<SaveResponse>, (StatusCode, String)> {
    if req.client_id.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "clientId required".into()));
    }
    if req.messages.is_empty() {
        // Nothing meaningful to save — peer left before any speech.
        return Ok(Json(SaveResponse { id: String::new() }));
    }

    let id = Uuid::new_v4().to_string();
    let mut tx = state
        .db
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("db: {e}")))?;

    sqlx::query(
        "INSERT INTO conversations \
         (id, client_id, room_id, speaker_lang, partner_lang, started_at, ended_at, message_count) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&req.client_id)
    .bind(&req.room_id)
    .bind(&req.speaker_lang)
    .bind(&req.partner_lang)
    .bind(req.started_at)
    .bind(req.ended_at)
    .bind(req.messages.len() as i64)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("db: {e}")))?;

    for m in &req.messages {
        sqlx::query(
            "INSERT INTO messages \
             (conversation_id, who, original, translated, lang_original, lang_translated, ts) \
             VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&m.who)
        .bind(&m.original)
        .bind(&m.translated)
        .bind(&m.lang_original)
        .bind(&m.lang_translated)
        .bind(m.ts)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("db: {e}")))?;
    }

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("db: {e}")))?;

    Ok(Json(SaveResponse { id }))
}

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    #[serde(rename = "clientId")]
    pub client_id: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ConversationSummary {
    pub id: String,
    #[serde(rename = "roomId")]
    #[sqlx(rename = "room_id")]
    pub room_id: String,
    #[serde(rename = "speakerLang")]
    #[sqlx(rename = "speaker_lang")]
    pub speaker_lang: String,
    #[serde(rename = "partnerLang")]
    #[sqlx(rename = "partner_lang")]
    pub partner_lang: String,
    #[serde(rename = "startedAt")]
    #[sqlx(rename = "started_at")]
    pub started_at: i64,
    #[serde(rename = "endedAt")]
    #[sqlx(rename = "ended_at")]
    pub ended_at: i64,
    #[serde(rename = "messageCount")]
    #[sqlx(rename = "message_count")]
    pub message_count: i64,
}

pub async fn list(
    State(state): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<ConversationSummary>>, (StatusCode, String)> {
    if q.client_id.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "clientId required".into()));
    }
    let rows = sqlx::query_as::<_, ConversationSummary>(
        "SELECT id, room_id, speaker_lang, partner_lang, started_at, ended_at, message_count \
         FROM conversations WHERE client_id = ? ORDER BY started_at DESC LIMIT 50",
    )
    .bind(&q.client_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("db: {e}")))?;
    Ok(Json(rows))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ConversationMessage {
    pub who: String,
    pub original: String,
    pub translated: String,
    #[serde(rename = "langOriginal")]
    #[sqlx(rename = "lang_original")]
    pub lang_original: String,
    #[serde(rename = "langTranslated")]
    #[sqlx(rename = "lang_translated")]
    pub lang_translated: String,
    pub ts: i64,
}

#[derive(Debug, Serialize)]
pub struct ConversationDetail {
    #[serde(flatten)]
    pub summary: ConversationSummary,
    pub messages: Vec<ConversationMessage>,
}

pub async fn detail(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ConversationDetail>, (StatusCode, String)> {
    let summary = sqlx::query_as::<_, ConversationSummary>(
        "SELECT id, room_id, speaker_lang, partner_lang, started_at, ended_at, message_count \
         FROM conversations WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("db: {e}")))?
    .ok_or((StatusCode::NOT_FOUND, "not found".into()))?;

    let messages = sqlx::query_as::<_, ConversationMessage>(
        "SELECT who, original, translated, lang_original, lang_translated, ts \
         FROM messages WHERE conversation_id = ? ORDER BY ts ASC",
    )
    .bind(&id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("db: {e}")))?;

    Ok(Json(ConversationDetail { summary, messages }))
}
