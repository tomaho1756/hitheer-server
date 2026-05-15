use axum::extract::ws::{Message, WebSocket};
use axum::extract::{State, WebSocketUpgrade};
use axum::response::Response;
use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use tracing::{debug, info, warn};
use uuid::Uuid;

use crate::matching::MatchRequest;
use crate::protocol::{ClientToServer, ServerToClient};
use crate::rooms::Rooms;
use crate::AppState;

pub async fn ws_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: AppState) {
    let peer_id = Uuid::new_v4();
    let (mut sink, mut stream) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<ServerToClient>();
    state.peers.register(peer_id, tx.clone());

    let writer = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            let text = match serde_json::to_string(&msg) {
                Ok(s) => s,
                Err(e) => {
                    warn!(error = %e, "serialize server msg failed");
                    continue;
                }
            };
            if sink.send(Message::Text(text)).await.is_err() {
                break;
            }
        }
        let _ = sink.close().await;
    });

    let mut current_room: Option<String> = None;
    info!(%peer_id, "peer connected");

    while let Some(Ok(msg)) = stream.next().await {
        match msg {
            Message::Text(text) => {
                let parsed: Result<ClientToServer, _> = serde_json::from_str(&text);
                let Ok(cmd) = parsed else {
                    let _ = tx.send(ServerToClient::Error {
                        message: format!("invalid message: {}", parsed.unwrap_err()),
                    });
                    continue;
                };

                match cmd {
                    ClientToServer::FindMatch { speaks, wants, allow_any } => {
                        let req = MatchRequest { speaks, wants, allow_any };
                        if req.speaks.is_empty() || req.wants.is_empty() {
                            let _ = tx.send(ServerToClient::Error {
                                message: "speaks/wants required".into(),
                            });
                            continue;
                        }
                        match state.matcher.enqueue_or_match(peer_id, &req).await {
                            Ok(Some(matched)) => {
                                let other_tx = state.peers.get(matched.other_peer);
                                if let Some(other_tx) = other_tx {
                                    let _ = other_tx.send(ServerToClient::MatchFound {
                                        room_id: matched.room_id.clone(),
                                        should_offer: true,
                                    });
                                    let _ = tx.send(ServerToClient::MatchFound {
                                        room_id: matched.room_id,
                                        should_offer: false,
                                    });
                                } else {
                                    // Partner disconnected between SPOP and dispatch.
                                    warn!(?matched, "matched peer no longer connected, requeueing");
                                    // Just retry once: enqueue self.
                                    let _ = state.matcher.enqueue_or_match(peer_id, &req).await;
                                    let _ = tx.send(ServerToClient::Queued);
                                }
                            }
                            Ok(None) => {
                                let _ = tx.send(ServerToClient::Queued);
                            }
                            Err(e) => {
                                warn!(error = ?e, "matcher error");
                                let _ = tx.send(ServerToClient::Error {
                                    message: "matchmaking unavailable".into(),
                                });
                            }
                        }
                    }
                    ClientToServer::CancelMatch => {
                        let _ = state.matcher.cancel(peer_id).await;
                    }
                    ClientToServer::Join { room_id } => {
                        if let Some(prev) = current_room.take() {
                            for other in state.rooms.leave(&prev, peer_id) {
                                let _ = other.send(ServerToClient::PeerLeft);
                            }
                        }
                        match state.rooms.join(&room_id, peer_id, tx.clone()) {
                            Ok(result) => {
                                let _ = tx.send(ServerToClient::Joined {
                                    room_id: room_id.clone(),
                                    peer_count: result.peer_count,
                                    should_offer: result.should_offer,
                                });
                                for other in result.other_peers {
                                    let _ = other.send(ServerToClient::PeerJoined);
                                }
                                current_room = Some(room_id);
                            }
                            Err(reason) => {
                                let _ = tx.send(ServerToClient::Error {
                                    message: reason.to_string(),
                                });
                            }
                        }
                    }
                    ClientToServer::Leave => {
                        if let Some(prev) = current_room.take() {
                            for other in state.rooms.leave(&prev, peer_id) {
                                let _ = other.send(ServerToClient::PeerLeft);
                            }
                        }
                    }
                    ClientToServer::Offer { sdp } => {
                        forward(&state.rooms, &current_room, peer_id, ServerToClient::Offer { sdp });
                    }
                    ClientToServer::Answer { sdp } => {
                        forward(&state.rooms, &current_room, peer_id, ServerToClient::Answer { sdp });
                    }
                    ClientToServer::IceCandidate { candidate } => {
                        forward(
                            &state.rooms,
                            &current_room,
                            peer_id,
                            ServerToClient::IceCandidate { candidate },
                        );
                    }
                }
            }
            Message::Close(_) => break,
            Message::Ping(_) | Message::Pong(_) | Message::Binary(_) => {
                debug!("ignored non-text frame");
            }
        }
    }

    let _ = state.matcher.cancel(peer_id).await;
    state.peers.unregister(peer_id);
    if let Some(prev) = current_room.take() {
        for other in state.rooms.leave(&prev, peer_id) {
            let _ = other.send(ServerToClient::PeerLeft);
        }
    }
    drop(tx);
    let _ = writer.await;
    info!(%peer_id, "peer disconnected");
}

fn forward(rooms: &Rooms, room: &Option<String>, peer_id: Uuid, msg: ServerToClient) {
    let Some(room_id) = room else { return };
    for other in rooms.others(room_id, peer_id) {
        let _ = other.send(msg.clone());
    }
}
