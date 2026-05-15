use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum ClientToServer {
    FindMatch {
        speaks: Vec<String>,
        wants: Vec<String>,
        #[serde(rename = "allowAny", default)]
        allow_any: bool,
    },
    CancelMatch,
    Join { #[serde(rename = "roomId")] room_id: String },
    Leave,
    Offer { sdp: String },
    Answer { sdp: String },
    IceCandidate { candidate: IceCandidatePayload },
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum ServerToClient {
    Queued,
    MatchFound {
        #[serde(rename = "roomId")]
        room_id: String,
        #[serde(rename = "shouldOffer")]
        should_offer: bool,
    },
    Joined {
        #[serde(rename = "roomId")]
        room_id: String,
        #[serde(rename = "peerCount")]
        peer_count: usize,
        #[serde(rename = "shouldOffer")]
        should_offer: bool,
    },
    PeerJoined,
    PeerLeft,
    Offer { sdp: String },
    Answer { sdp: String },
    IceCandidate { candidate: IceCandidatePayload },
    Error { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IceCandidatePayload {
    pub candidate: String,
    #[serde(rename = "sdpMid")]
    pub sdp_mid: Option<String>,
    #[serde(rename = "sdpMLineIndex")]
    pub sdp_mline_index: Option<u16>,
}
