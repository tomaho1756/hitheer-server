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
    Subtitle {
        id: String,
        original: String,
        translated: String,
        #[serde(rename = "langOriginal")]
        lang_original: String,
        #[serde(rename = "langTranslated")]
        lang_translated: String,
        ts: i64,
        #[serde(rename = "final")]
        is_final: bool,
    },
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
        /// First language the user speaks (= what they'll talk in).
        #[serde(rename = "mySpeaks")]
        my_speaks: String,
        /// First language the partner speaks (= translation target).
        #[serde(rename = "partnerSpeaks")]
        partner_speaks: String,
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
    Subtitle {
        id: String,
        original: String,
        translated: String,
        #[serde(rename = "langOriginal")]
        lang_original: String,
        #[serde(rename = "langTranslated")]
        lang_translated: String,
        ts: i64,
        #[serde(rename = "final")]
        is_final: bool,
    },
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
