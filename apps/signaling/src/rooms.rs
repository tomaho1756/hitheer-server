use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::protocol::ServerToClient;

pub type PeerId = Uuid;
pub type Tx = mpsc::UnboundedSender<ServerToClient>;

#[derive(Default)]
pub struct Rooms {
    inner: DashMap<String, Vec<(PeerId, Tx)>>,
}

pub struct JoinResult {
    pub peer_count: usize,
    pub should_offer: bool,
    pub other_peers: Vec<Tx>,
}

impl Rooms {
    pub fn new() -> Arc<Self> {
        Arc::new(Self::default())
    }

    /// Add `peer` to `room_id`. Caps the room at 2 participants for 1:1.
    /// Returns Err with a reason if the room is full.
    pub fn join(&self, room_id: &str, peer_id: PeerId, tx: Tx) -> Result<JoinResult, &'static str> {
        let mut entry = self.inner.entry(room_id.to_string()).or_default();
        if entry.len() >= 2 {
            return Err("room is full");
        }
        let should_offer = !entry.is_empty();
        let other_peers: Vec<Tx> = entry.iter().map(|(_, tx)| tx.clone()).collect();
        entry.push((peer_id, tx));
        Ok(JoinResult {
            peer_count: entry.len(),
            should_offer,
            other_peers,
        })
    }

    /// Returns the senders of all other peers in the room.
    pub fn others(&self, room_id: &str, peer_id: PeerId) -> Vec<Tx> {
        self.inner
            .get(room_id)
            .map(|entry| {
                entry
                    .iter()
                    .filter(|(id, _)| *id != peer_id)
                    .map(|(_, tx)| tx.clone())
                    .collect()
            })
            .unwrap_or_default()
    }

    pub fn leave(&self, room_id: &str, peer_id: PeerId) -> Vec<Tx> {
        let mut remaining_others = Vec::new();
        let mut should_remove = false;
        if let Some(mut entry) = self.inner.get_mut(room_id) {
            entry.retain(|(id, _)| *id != peer_id);
            remaining_others = entry.iter().map(|(_, tx)| tx.clone()).collect();
            should_remove = entry.is_empty();
        }
        if should_remove {
            self.inner.remove(room_id);
        }
        remaining_others
    }
}
