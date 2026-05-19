# coturn 배포 (GCE e2-micro 무료 티어)

## 0. 사전 준비
- GCP 프로젝트: `hitheer-app`
- 도메인: 예) `turn.hithere.kro.kr` (또는 `turn.hithere.dedyn.io`)
- 시그널링과 공유할 secret: `openssl rand -hex 32`

## 1. VM 생성

```bash
PROJECT=hitheer-app
ZONE=us-central1-a   # 무료 티어: us-west1/central1/east1 중 하나
NAME=hithere-turn

gcloud compute instances create $NAME \
  --project=$PROJECT \
  --zone=$ZONE \
  --machine-type=e2-micro \
  --image-family=debian-12 --image-project=debian-cloud \
  --boot-disk-size=30GB --boot-disk-type=pd-standard \
  --tags=coturn \
  --metadata=startup-script='#!/bin/bash
apt-get update && apt-get install -y docker.io docker-compose-plugin certbot
systemctl enable --now docker'
```

## 2. 정적 외부 IP 예약 + 부착

```bash
gcloud compute addresses create hithere-turn-ip --region=us-central1 --project=$PROJECT
IP=$(gcloud compute addresses describe hithere-turn-ip --region=us-central1 --project=$PROJECT --format='value(address)')
gcloud compute instances delete-access-config $NAME --zone=$ZONE --access-config-name="External NAT" --project=$PROJECT
gcloud compute instances add-access-config $NAME --zone=$ZONE --address=$IP --project=$PROJECT
echo "TURN external IP = $IP"
```

이 IP를 DNS의 `turn.<도메인>` A 레코드로 등록.

## 3. 방화벽 규칙

TURN은 UDP 3478 (기본), 5349 (TLS), 그리고 relay 포트 range. coturn 설정의 `min-port`/`max-port`와 일치시키자. 우리 기본 49160-49200.

```bash
gcloud compute firewall-rules create allow-coturn \
  --project=$PROJECT \
  --direction=INGRESS \
  --action=ALLOW \
  --rules=tcp:3478,udp:3478,tcp:5349,udp:5349,udp:49160-49200 \
  --target-tags=coturn \
  --source-ranges=0.0.0.0/0
```

## 4. TLS 인증서 (Let's Encrypt, DNS-01)

VM에 SSH:
```bash
gcloud compute ssh $NAME --zone=$ZONE --project=$PROJECT
```

VM 안에서:
```bash
sudo certbot certonly --manual --preferred-challenges=dns \
  -d turn.hithere.kro.kr \
  --register-unsafely-without-email \
  --agree-tos
```

`_acme-challenge.turn.hithere.kro.kr` TXT 레코드 추가 안내가 나오면 도메인 패널에 추가. 2~5분 후 확인 → Enter.

발급되면 cert는 `/etc/letsencrypt/live/turn.hithere.kro.kr/`에 저장됨.

**갱신 자동화** (90일마다):
```bash
echo "0 3 * * * root certbot renew --quiet && docker restart coturn" | sudo tee /etc/cron.d/certbot-coturn
```

## 5. coturn 띄우기

VM에 hithere repo의 `infra/` 폴더만 가져오자:

```bash
mkdir -p /opt/hithere && cd /opt/hithere
# 옵션 A: rsync from local
#   rsync -av infra/ <vm>:/opt/hithere/infra/
# 옵션 B: git clone (public repo면)
#   git clone https://github.com/<you>/hithere.git
#   cp -r hithere/infra .

EXTERNAL_IP=$(curl -s https://api.ipify.org) \
STATIC_AUTH_SECRET=<signaling과 동일한 값> \
REALM=hithere \
./infra/render-coturn.sh

# turnserver.conf.rendered에 TLS 줄 추가:
cat >> infra/coturn/turnserver.conf.rendered <<EOF
cert=/etc/coturn/fullchain.pem
pkey=/etc/coturn/privkey.pem
EOF
```

`infra/docker-compose.yml` 의 volumes에 cert 마운트 추가:

```yaml
services:
  coturn:
    image: coturn/coturn:4.6
    restart: unless-stopped
    network_mode: host
    volumes:
      - ./coturn/turnserver.conf.rendered:/etc/coturn/turnserver.conf:ro
      - /etc/letsencrypt/live/turn.hithere.kro.kr/fullchain.pem:/etc/coturn/fullchain.pem:ro
      - /etc/letsencrypt/live/turn.hithere.kro.kr/privkey.pem:/etc/coturn/privkey.pem:ro
      - /etc/letsencrypt/archive:/etc/letsencrypt/archive:ro
    command: ["-c", "/etc/coturn/turnserver.conf"]
```

띄우기:
```bash
cd /opt/hithere
sudo docker compose up -d
sudo docker logs coturn --tail=20
```

## 6. 검증

로컬에서:
```bash
# TURN 서버가 응답하는지
turnutils_uclient -t -T <STATIC_AUTH_SECRET> -u $(date +%s):test \
  -p 3478 -s -y turn.hithere.kro.kr
```

또는 https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/ 에 `turn:turn.hithere.kro.kr:3478?transport=udp` + credentials 넣어서 "Done" 까지 가는지 확인.

## 7. 시그널링에 연결

Cloud Run signaling의 환경변수에 추가 (cloudbuild.yaml substitutions에서):
```
_TURN_STATIC_AUTH_SECRET=<위와 동일>
_TURN_URIS=turn:turn.hithere.kro.kr:3478?transport=udp,turn:turn.hithere.kro.kr:3478?transport=tcp,turns:turn.hithere.kro.kr:5349?transport=tcp
```

웹 클라이언트는 `/turn-credentials` 호출 → 짧은 만료의 username/password 받음 → `RTCPeerConnection`에 자동 적용 (코드는 이미 완료).

## 비용

- GCE e2-micro (us-west1/central1/east1): 항상 무료 (한 달 1대)
- Static IP: VM에 부착되어 있으면 무료, 사용 안 하면 시간당 ~$0.005
- Egress: 1GB/월 무료, 그 이후 $0.12/GB

소규모 운영에서는 사실상 $0.
