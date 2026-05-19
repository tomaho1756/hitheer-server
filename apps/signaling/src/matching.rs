use std::collections::HashMap;
use std::sync::Mutex;

use redis::aio::ConnectionManager;
use uuid::Uuid;

use crate::rooms::{PeerId, Tx};

/// Wildcard token used to represent "anything" in either direction (global pool).
pub const ANY: &str = "*";

#[derive(Debug, Clone)]
pub struct MatchRequest {
    pub speaks: Vec<String>,
    pub wants: Vec<String>,
    pub allow_any: bool,
}

impl MatchRequest {
    pub fn primary_speaks(&self) -> String {
        self.speaks.first().cloned().unwrap_or_else(|| "en".to_string())
    }
}

#[derive(Debug)]
pub struct Matched {
    pub room_id: String,
    pub other_peer: PeerId,
}

#[derive(Default)]
pub struct PeerRegistry {
    txs: Mutex<HashMap<PeerId, Tx>>,
    prefs: Mutex<HashMap<PeerId, MatchRequest>>,
}

impl PeerRegistry {
    pub fn register(&self, id: PeerId, tx: Tx) {
        self.txs.lock().unwrap().insert(id, tx);
    }
    pub fn unregister(&self, id: PeerId) {
        self.txs.lock().unwrap().remove(&id);
        self.prefs.lock().unwrap().remove(&id);
    }
    pub fn get(&self, id: PeerId) -> Option<Tx> {
        self.txs.lock().unwrap().get(&id).cloned()
    }
    pub fn set_prefs(&self, id: PeerId, req: MatchRequest) {
        self.prefs.lock().unwrap().insert(id, req);
    }
    pub fn get_prefs(&self, id: PeerId) -> Option<MatchRequest> {
        self.prefs.lock().unwrap().get(&id).cloned()
    }
}

pub struct Matcher {
    redis: ConnectionManager,
}

impl Matcher {
    pub async fn connect(url: &str) -> anyhow::Result<Self> {
        let client = redis::Client::open(url)?;
        let mgr = ConnectionManager::new(client).await?;
        Ok(Self { redis: mgr })
    }

    pub async fn enqueue_or_match(
        &self,
        peer_id: PeerId,
        req: &MatchRequest,
    ) -> anyhow::Result<Option<Matched>> {
        let mine: Vec<String> = pool_names_self(&req.speaks, &req.wants, req.allow_any);
        let counterparts: Vec<String> = pool_names_counterpart(&req.speaks, &req.wants, req.allow_any);
        let peer = peer_id.to_string();

        let script = redis::Script::new(MATCH_LUA);
        let mut redis = self.redis.clone();
        let result: Option<String> = script
            .arg(&peer)
            .arg(counterparts.join(";"))
            .arg(mine.join(";"))
            .invoke_async(&mut redis)
            .await?;

        if let Some(other) = result {
            let other_uuid = Uuid::parse_str(&other)?;
            Ok(Some(Matched {
                room_id: Uuid::new_v4().to_string(),
                other_peer: other_uuid,
            }))
        } else {
            Ok(None)
        }
    }

    pub async fn cancel(&self, peer_id: PeerId) -> anyhow::Result<()> {
        let peer = peer_id.to_string();
        let script = redis::Script::new(CANCEL_LUA);
        let mut redis = self.redis.clone();
        let _: () = script.arg(&peer).invoke_async(&mut redis).await?;
        Ok(())
    }
}

fn pool_names_self(speaks: &[String], wants: &[String], allow_any: bool) -> Vec<String> {
    let mut out = Vec::new();
    for s in speaks {
        for w in wants {
            out.push(format!("pool:{s}->{w}"));
        }
        if allow_any {
            out.push(format!("pool:{s}->{ANY}"));
        }
    }
    if allow_any {
        for w in wants {
            out.push(format!("pool:{ANY}->{w}"));
        }
        out.push(format!("pool:{ANY}->{ANY}"));
    }
    out
}

fn pool_names_counterpart(speaks: &[String], wants: &[String], allow_any: bool) -> Vec<String> {
    let mut out = Vec::new();
    for s in speaks {
        for w in wants {
            out.push(format!("pool:{w}->{s}"));
        }
    }
    if allow_any {
        for s in speaks {
            out.push(format!("pool:{ANY}->{s}"));
        }
        for w in wants {
            out.push(format!("pool:{w}->{ANY}"));
        }
        out.push(format!("pool:{ANY}->{ANY}"));
    }
    out
}

const MATCH_LUA: &str = r#"
local peer = ARGV[1]
local counterparts = {}
for s in string.gmatch(ARGV[2], "([^;]+)") do table.insert(counterparts, s) end
local mine = {}
for s in string.gmatch(ARGV[3], "([^;]+)") do table.insert(mine, s) end

for _, pool in ipairs(counterparts) do
  local other = redis.call("SPOP", pool)
  if other then
    local membership = "peer:" .. other .. ":pools"
    local pools = redis.call("SMEMBERS", membership)
    for _, p in ipairs(pools) do
      redis.call("SREM", p, other)
    end
    redis.call("DEL", membership)
    return other
  end
end

for _, pool in ipairs(mine) do
  redis.call("SADD", pool, peer)
  redis.call("EXPIRE", pool, 300)
  redis.call("SADD", "peer:" .. peer .. ":pools", pool)
end
redis.call("EXPIRE", "peer:" .. peer .. ":pools", 300)

return nil
"#;

const CANCEL_LUA: &str = r#"
local peer = ARGV[1]
local membership = "peer:" .. peer .. ":pools"
local pools = redis.call("SMEMBERS", membership)
for _, p in ipairs(pools) do
  redis.call("SREM", p, peer)
end
redis.call("DEL", membership)
return 1
"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn self_and_counterpart_pools_are_inverses() {
        let speaks = vec!["ko".to_string()];
        let wants = vec!["en".to_string()];
        let mine = pool_names_self(&speaks, &wants, false);
        let cp = pool_names_counterpart(&speaks, &wants, false);
        assert_eq!(mine, vec!["pool:ko->en"]);
        assert_eq!(cp, vec!["pool:en->ko"]);
    }

    #[test]
    fn allow_any_adds_wildcard_pools() {
        let speaks = vec!["ko".to_string()];
        let wants = vec!["en".to_string()];
        let mine = pool_names_self(&speaks, &wants, true);
        assert!(mine.contains(&"pool:ko->*".to_string()));
        assert!(mine.contains(&"pool:*->en".to_string()));
        assert!(mine.contains(&"pool:*->*".to_string()));
    }
}
