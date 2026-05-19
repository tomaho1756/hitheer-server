use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};

use crate::AppState;

#[derive(Debug, Clone)]
pub struct RealtimeConfig {
    pub api_key: String,
    pub model: String,
    pub transcribe_model: String,
}

impl RealtimeConfig {
    pub fn from_env() -> Self {
        Self {
            api_key: std::env::var("OPENAI_API_KEY").unwrap_or_default(),
            model: std::env::var("OPENAI_REALTIME_MODEL")
                .unwrap_or_else(|_| "gpt-realtime".to_string()),
            transcribe_model: std::env::var("OPENAI_TRANSCRIBE_MODEL")
                .unwrap_or_else(|_| "gpt-4o-transcribe".to_string()),
        }
    }

    pub fn is_configured(&self) -> bool {
        !self.api_key.is_empty()
    }
}

#[derive(Debug, Deserialize)]
pub struct SessionRequest {
    #[serde(rename = "speakerLang")]
    pub speaker_lang: String,
    #[serde(rename = "partnerLang")]
    pub partner_lang: String,
}

#[derive(Debug, Serialize)]
pub struct SessionResponse {
    pub model: String,
    pub client_secret: ClientSecret,
}

#[derive(Debug, Serialize)]
pub struct ClientSecret {
    pub value: String,
}

/// Issues an ephemeral client secret usable for one Realtime WebRTC connection.
/// Uses the GA endpoint POST /v1/realtime/client_secrets.
pub async fn realtime_session(
    State(state): State<AppState>,
    Json(req): Json<SessionRequest>,
) -> Result<Json<SessionResponse>, (StatusCode, String)> {
    let cfg = &state.realtime;
    if !cfg.is_configured() {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            "OPENAI_API_KEY not configured".to_string(),
        ));
    }

    let instructions = build_instructions(&req.speaker_lang, &req.partner_lang);

    let body = serde_json::json!({
        "session": {
            "type": "realtime",
            "model": cfg.model,
            "instructions": instructions,
            "output_modalities": ["text"],
            "audio": {
                "input": {
                    "transcription": {
                        "model": cfg.transcribe_model,
                        "language": req.speaker_lang,
                    },
                    "noise_reduction": { "type": "near_field" },
                    "turn_detection": {
                        "type": "server_vad",
                        "threshold": 0.5,
                        "silence_duration_ms": 200
                    }
                }
            },
        },
    });

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.openai.com/v1/realtime/client_secrets")
        .bearer_auth(&cfg.api_key)
        .header("OpenAI-Beta", "realtime=v1")
        .json(&body)
        .send()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("openai request failed: {e}")))?;

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("openai body read failed: {e}")))?;
    if !status.is_success() {
        return Err((StatusCode::BAD_GATEWAY, format!("openai {status}: {text}")));
    }

    // The GA response includes a top-level `value` (the ephemeral key). Some variants
    // also nest extra metadata; we only need the value.
    let parsed: serde_json::Value = serde_json::from_str(&text).map_err(|e| {
        (
            StatusCode::BAD_GATEWAY,
            format!("openai response parse failed: {e}; body={text}"),
        )
    })?;
    let value = parsed
        .get("value")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| {
            (
                StatusCode::BAD_GATEWAY,
                format!("openai response missing `value`: body={text}"),
            )
        })?;

    Ok(Json(SessionResponse {
        model: cfg.model.clone(),
        client_secret: ClientSecret { value },
    }))
}

fn build_instructions(speaker_lang: &str, partner_lang: &str) -> String {
    format!(
        "You are a machine translation engine. Your ONLY job: translate the user's audio from {speaker} into {partner}.\n\
\n\
ABSOLUTE RULES (no exceptions):\n\
1. Output ONLY the translation of the CURRENT utterance. Nothing else.\n\
2. NEVER respond as an assistant. NEVER answer questions in the input. NEVER add commentary, follow-up, or context.\n\
3. IGNORE all prior turns. Each input is a standalone phrase to translate.\n\
4. Match the input length closely. Short input → short translation. \"Hi\" must translate to one or two words, never a sentence.\n\
5. If you cannot understand the input, output an empty string. Do NOT guess or invent content.\n\
6. If the input is already in {partner}, repeat it verbatim.\n\
7. Preserve names, numbers, brand names exactly as spoken.\n\
8. No quotation marks, no \"Translation:\" prefix, no explanations.\n\
\n\
Examples (English → Korean):\n\
- \"Hi\" → \"안녕\"\n\
- \"Sure.\" → \"네.\"\n\
- \"What's your name?\" → \"이름이 뭐예요?\"\n\
- \"My name is Paul.\" → \"제 이름은 폴이에요.\"",
        speaker = lang_name(speaker_lang),
        partner = lang_name(partner_lang),
    )
}

#[derive(Debug, Deserialize)]
pub struct RetranslateRequest {
    pub text: String,
    #[serde(rename = "sourceLang")]
    pub source_lang: String,
    #[serde(rename = "targetLang")]
    pub target_lang: String,
}

#[derive(Debug, Serialize)]
pub struct RetranslateResponse {
    pub translation: String,
}

/// Re-translates a single utterance via OpenAI chat completion (non-realtime).
/// Used by the conversation panel's "재번역" menu so the user can request a
/// fresh translation of any past line.
pub async fn retranslate(
    State(state): State<AppState>,
    Json(req): Json<RetranslateRequest>,
) -> Result<Json<RetranslateResponse>, (StatusCode, String)> {
    let cfg = &state.realtime;
    if !cfg.is_configured() {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            "OPENAI_API_KEY not configured".to_string(),
        ));
    }
    let trimmed = req.text.trim();
    if trimmed.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "text is empty".to_string()));
    }

    let system_prompt = format!(
        "You are a precise translator. Translate the user's message from {source} to {target}. \
Reply with ONLY the translated text — no greetings, no quotes, no explanations. \
Preserve names, numbers, and punctuation natural for {target}.",
        source = lang_name(&req.source_lang),
        target = lang_name(&req.target_lang),
    );

    let body = serde_json::json!({
        "model": "gpt-4o-mini",
        "temperature": 0.2,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": trimmed }
        ]
    });

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(&cfg.api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("openai request failed: {e}")))?;

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("openai body read failed: {e}")))?;
    if !status.is_success() {
        return Err((StatusCode::BAD_GATEWAY, format!("openai {status}: {text}")));
    }

    let parsed: serde_json::Value = serde_json::from_str(&text).map_err(|e| {
        (
            StatusCode::BAD_GATEWAY,
            format!("openai response parse failed: {e}; body={text}"),
        )
    })?;
    let translation = parsed
        .get("choices")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .map(|s| s.trim().to_string())
        .ok_or_else(|| {
            (
                StatusCode::BAD_GATEWAY,
                format!("openai response missing translation: body={text}"),
            )
        })?;

    Ok(Json(RetranslateResponse { translation }))
}

fn lang_name(code: &str) -> &'static str {
    match code {
        "ko" => "Korean",
        "en" => "English",
        "ja" => "Japanese",
        "zh" => "Chinese",
        "es" => "Spanish",
        "fr" => "French",
        "de" => "German",
        "vi" => "Vietnamese",
        _ => "the partner's language",
    }
}
