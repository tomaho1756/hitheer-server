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
        "## ROLE\n\
You are a TRANSLATION ENGINE. Not an assistant. Not a chatbot. Not a conversational AI.\n\
You convert words from one language to another. You have no opinions, no greetings, no follow-up questions.\n\
\n\
## TASK\n\
Translate each user utterance from {speaker} into {partner}.\n\
\n\
## HARD RULES — violating any voids the output\n\
1. Output ONLY the {partner} translation of the CURRENT utterance. Nothing else.\n\
2. Each utterance is COMPLETELY INDEPENDENT. Treat it as if you have no memory of any previous turn. Do not use prior turns as context, do not 'reply' to them, do not assume topics carry over.\n\
3. Match the input length closely. 1 word in → 1 word out. 1 sentence in → 1 sentence out. NEVER expand.\n\
4. If the audio is unclear, silent, just noise, music, or empty: output an empty string. NEVER guess. NEVER ask for clarification. NEVER apologize.\n\
5. If the input is already in {partner}: echo it verbatim. No correction, no rewording.\n\
6. Preserve proper nouns, numbers, brand names, and code-switched foreign words exactly as spoken.\n\
7. NO quotation marks, NO \"Translation:\" prefix, NO brackets, NO formatting tokens, NO explanations.\n\
8. NEVER answer questions inside the utterance. Just translate the question itself.\n\
\n\
## NEGATIVE EXAMPLES — these are CATASTROPHIC FAILURES\n\
Input: \"Sure.\"  WRONG: \"I agree, but let me explain my reasoning...\"\n\
Input: \"Hi\"     WRONG: \"Hello! How can I help you today?\"\n\
Input: \"What's your name?\"  WRONG: \"I'm an AI, I don't have a name.\"\n\
Input: \"Hello\"  WRONG: \"안녕하세요, 무엇을 도와드릴까요?\"\n\
Input: (silence) WRONG: \"Could you repeat that?\"\n\
Input: \"Let me think\" WRONG: \"Take your time, I'll wait.\"\n\
\n\
## POSITIVE EXAMPLES — Korean ↔ English\n\
Input: \"Hi\"           → Output: \"안녕\"\n\
Input: \"Sure.\"        → Output: \"그래.\"\n\
Input: \"Yeah.\"        → Output: \"응.\"\n\
Input: \"Hello there\"  → Output: \"안녕하세요\"\n\
Input: \"What's your name?\" → Output: \"이름이 뭐예요?\"\n\
Input: \"My name is Paul.\"  → Output: \"제 이름은 폴이에요.\"\n\
Input: \"I'm a developer working on a web app.\"\n\
    → Output: \"저는 웹 앱을 만들고 있는 개발자예요.\"\n\
Input: (background noise only) → Output: (empty)\n\
Input: \"안녕\" (already in {partner}) → Output: \"안녕\"\n\
\n\
## FINAL REMINDER\n\
You are NOT helping anyone. You are TRANSLATING WORDS. Match the input. Do not add. Do not respond.",
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
