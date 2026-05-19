use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::path::Path;
use std::str::FromStr;

pub type Db = SqlitePool;

pub async fn connect(path: &str) -> anyhow::Result<Db> {
    // Make sure the parent directory exists, otherwise sqlite create_if_missing fails.
    if let Some(parent) = Path::new(path).parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).ok();
        }
    }

    let opts = SqliteConnectOptions::from_str(&format!("sqlite://{path}"))?
        .create_if_missing(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(opts)
        .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS conversations (
            id              TEXT PRIMARY KEY,
            client_id       TEXT NOT NULL,
            room_id         TEXT NOT NULL,
            speaker_lang    TEXT NOT NULL,
            partner_lang    TEXT NOT NULL,
            started_at      INTEGER NOT NULL,
            ended_at        INTEGER NOT NULL,
            message_count   INTEGER NOT NULL DEFAULT 0
        );
        "#,
    )
    .execute(&pool)
    .await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_conversations_client
            ON conversations(client_id, started_at DESC);
        "#,
    )
    .execute(&pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS messages (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id TEXT NOT NULL,
            who             TEXT NOT NULL,
            original        TEXT NOT NULL,
            translated      TEXT NOT NULL,
            lang_original   TEXT NOT NULL,
            lang_translated TEXT NOT NULL,
            ts              INTEGER NOT NULL,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );
        "#,
    )
    .execute(&pool)
    .await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_messages_conv
            ON messages(conversation_id, ts ASC);
        "#,
    )
    .execute(&pool)
    .await?;

    Ok(pool)
}
