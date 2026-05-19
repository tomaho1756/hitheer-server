# hithere 배포 가이드

전체 토폴로지:

```
                       ┌─────────────────────────────┐
  사용자 (브라우저) ───▶│ Firebase App Hosting (web)  │── Next.js (apps/web)
                       └──────────────┬──────────────┘
                                      │ wss / https
                       ┌──────────────▼──────────────┐
                       │ Cloud Run (signaling)        │── Rust axum (apps/signaling)
                       └──────────────┬──────────────┘
                                      │ TCP
                       ┌──────────────▼──────────────┐
                       │ Upstash Redis (매칭 큐)      │
                       └──────────────────────────────┘
                                      │
                            STUN/TURN │
                       ┌──────────────▼──────────────┐
                       │ GCE coturn (e2-micro)        │── infra/coturn
                       └──────────────────────────────┘

Auth: Firebase Auth (Email + Google)
Storage: 일단 컨테이너 SQLite. Firestore 마이그레이션은 1차 운영 후.
도메인: hithere.kro.kr (or .dedyn.io)
```

## 0. 사전

- Firebase 프로젝트: `hitheer-app` (Blaze)
- 도메인: `hithere.kro.kr` (서브: `signaling.`, `turn.`)
- 환경: macOS / Apple Silicon, Docker Desktop

## 1. Firebase Auth 활성화 (콘솔 작업)

1. https://console.firebase.google.com/project/hitheer-app/authentication → 시작하기
2. Sign-in method 탭:
   - **Email/Password** 켜기
   - **Google** 켜기 — 프로젝트의 지원 이메일 선택
3. (선택) Authorized domains에 배포할 도메인 추가: `hithere.kro.kr`

## 2. 웹 앱 등록 + config 받기

1. https://console.firebase.google.com/project/hitheer-app/settings/general
2. "내 앱" → **</> 웹** → 닉네임 `hithere-web` → 등록
3. config 객체 복사:
   ```js
   const firebaseConfig = {
     apiKey: "...",
     authDomain: "hitheer-app.firebaseapp.com",
     projectId: "hitheer-app",
     storageBucket: "hitheer-app.appspot.com",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
4. `apps/web/.env.local`에 (개발용):
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=hitheer-app.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=hitheer-app
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=hitheer-app.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ```
5. 배포용은 Firebase Secret Manager에 시크릿으로 저장 (아래 4단계 참고)

## 3. 시그널링 배포 (Cloud Run)

```bash
# 1) Artifact Registry 한 번만
gcloud artifacts repositories create hithere \
  --repository-format=docker --location=asia-northeast3 --project=hitheer-app

# 2) Upstash Redis 생성: https://upstash.com/ → REST URL 받기
#    REDIS_URL 형식: redis://default:<password>@<host>:<port>

# 3) Cloud Build로 빌드+배포 (cloudbuild.yaml 사용)
gcloud builds submit \
  --config apps/signaling/cloudbuild.yaml \
  --substitutions=\
_REDIS_URL=rediss://default:xxx@xxx.upstash.io:6379,\
_OPENAI_API_KEY=sk-...,\
_FIREBASE_PROJECT_ID=hitheer-app,\
_TURN_STATIC_AUTH_SECRET=<openssl rand -hex 32>,\
_TURN_URIS=turn:turn.hithere.kro.kr:3478?transport=udp \
  --project=hitheer-app
```

배포 후 URL이 나옴. 그걸 `signaling.hithere.kro.kr` CNAME으로 매핑 (Cloud Run 커스텀 도메인 → 도메인 매핑 추가).

## 4. coturn 배포 (GCE)

`infra/coturn/DEPLOY-GCE.md` 참고. 요약:

1. GCE e2-micro VM 생성 (무료 티어)
2. 정적 IP 예약 + DNS A 레코드 (`turn.hithere.kro.kr`)
3. 방화벽 규칙 (UDP/TCP 3478, 5349, 49160-49200)
4. Let's Encrypt DNS-01 인증서
5. `docker compose up -d`로 coturn 띄움
6. signaling 환경변수에 TURN secret + URIs

## 5. 웹 배포 (Firebase App Hosting)

```bash
# 1) Firebase App Hosting 백엔드 생성 (콘솔이 더 쉬움)
#    Firebase 콘솔 → Build → App Hosting → 백엔드 만들기 → GitHub 연결
#    Root directory: apps/web
#    Branch: main
#    apphosting.yaml 자동 인식

# 2) Secret Manager에 NEXT_PUBLIC_FIREBASE_API_KEY 등 추가
firebase apphosting:secrets:set firebase-api-key --project hitheer-app
firebase apphosting:secrets:set firebase-messaging-sender-id --project hitheer-app
firebase apphosting:secrets:set firebase-app-id --project hitheer-app

# 3) 첫 롤아웃은 GitHub push 시 자동, 또는:
firebase apphosting:rollouts:create <BACKEND_ID> --project hitheer-app
```

도메인 매핑: 콘솔 → App Hosting → Custom Domain → `hithere.kro.kr` 추가. TXT/A 레코드 가이드대로 추가하면 자동 SSL.

## 6. 검증 체크리스트

- [ ] `https://hithere.kro.kr` 열면 홈 페이지 뜸
- [ ] 회원가입 → 로그인 → 헤더에 user pill
- [ ] 랜덤 매칭 또는 방 만들기 → 통화 페이지
- [ ] 두 기기에서 연결 확인 (영상 + 음성)
- [ ] TURN 통한 P2P 연결 (모바일 LTE 등 NAT 환경)
- [ ] 자막 + 번역 흐름
- [ ] /history 페이지에 기록 저장됨
- [ ] 통화 종료 시 conversation 저장 확인 (sqlite or Firestore)

## 7. 비용 예측 (소규모)

| 항목 | 무료 | 사용량 시 |
|------|------|-----------|
| Firebase App Hosting | $0 (Blaze 프리 티어) | 비례 |
| Firebase Auth | $0 (~50K MAU) | 비례 |
| Cloud Run | ~$0 (idle) | ~$0.0001/요청 |
| Upstash Redis | $0 (10K req/day) | $0.2 per 100K |
| GCE e2-micro | $0 (us-* 무료 티어) | $7/mo |
| Egress | 1GB/월 무료 | $0.12/GB |
| Firestore | 일부 무료 | 비례 |

소규모 (~50 동시 사용자) 기준 월 $5 이내.

## 다음 단계 (선택)

- Firestore 마이그레이션 (`apps/signaling/src/conversations.rs` → Firestore REST)
- Stripe 결제 (회의 녹화 / AI 분석 유료)
- 다인 회의 (mediasoup/LiveKit SFU 도입)
- 친구 추가 / 직접 전화 (Firebase Auth 기반)
- 회의 녹화 + 회의록 자동 요약 (GPT)
