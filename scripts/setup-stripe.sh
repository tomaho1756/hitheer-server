#!/usr/bin/env bash
#
# Stripe sandbox bootstrap for hithere.
#
# What it does:
#   1. (optionally) logs OUT of any cached Stripe CLI account.
#   2. Triggers 'stripe login' in test mode — browser tab opens, you approve.
#   3. Creates the two hithere products + recurring USD prices
#      (Pro $9.99/mo, Professional $39.99/mo). Skips if they already exist.
#   4. Writes the resulting price IDs into apps/web/.env.local.
#   5. Prints the next steps you still have to do MANUALLY:
#        - copy sk_test_… (restricted CLI key isn't the same as the server key)
#        - run 'stripe listen' to get whsec_… for the webhook secret
#        - paste FIREBASE_ADMIN_SA_JSON
#
# Usage:
#   bash scripts/setup-stripe.sh
#
# Re-runnable: products with the same name are reused, so it's safe to run
# multiple times.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/apps/web/.env.local"

if [ -t 1 ]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'
  RED=$'\033[31m'; CYAN=$'\033[36m'; RESET=$'\033[0m'
else
  BOLD=""; DIM=""; GREEN=""; YELLOW=""; RED=""; CYAN=""; RESET=""
fi
step() { printf "\n${BOLD}${CYAN}▸ %s${RESET}\n" "$*"; }
hint() { printf "${DIM}%s${RESET}\n" "$*"; }
ok()   { printf "${GREEN}✓ %s${RESET}\n" "$*"; }
warn() { printf "${YELLOW}! %s${RESET}\n" "$*"; }
err()  { printf "${RED}✗ %s${RESET}\n" "$*"; }

if ! command -v stripe >/dev/null 2>&1; then
  err "Stripe CLI가 설치되어 있지 않습니다."
  hint "macOS: brew install stripe/stripe-cli/stripe"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  err "jq가 필요합니다 (응답 파싱용)."
  hint "macOS: brew install jq"
  exit 1
fi

mkdir -p "$(dirname "$ENV_FILE")"
touch "$ENV_FILE"

set_env() {
  local key="$1"
  local val="$2"
  local tmp
  tmp=$(mktemp)
  grep -vE "^${key}=" "$ENV_FILE" > "$tmp" || true
  local escaped="${val//\'/\'\\\'\'}"
  printf "%s='%s'\n" "$key" "$escaped" >> "$tmp"
  mv "$tmp" "$ENV_FILE"
}

clear
cat <<EOF
${BOLD}hithere · Stripe 셋업 자동화${RESET}

이 스크립트는:
  1. 기존 Stripe CLI 세션을 ${YELLOW}로그아웃${RESET}하고
  2. 새 계정으로 ${YELLOW}stripe login${RESET}을 실행한 뒤
  3. Pro / Professional 상품 + 가격을 자동 생성하고
  4. price ID를 .env.local에 자동 기입합니다.

그래도 ${RED}직접 채워야 하는 값${RESET}이 있습니다:
  · STRIPE_SECRET_KEY   (Dashboard > Developers > API keys, sk_test_…)
  · STRIPE_WEBHOOK_SECRET (stripe listen 실행 후 출력되는 whsec_…)
  · FIREBASE_ADMIN_SA_JSON (Firebase 서비스 계정 .json 전체)

→ 이건 마지막에 인터랙티브 입력 스크립트로 받습니다.
EOF

# ── 1. 로그아웃 + 로그인 ────────────────────────────────────────────────
step "1. Stripe CLI 세션 초기화"
read -r -p "기존 stripe CLI 세션을 로그아웃할까요? [Y/n] " ans || true
ans=${ans:-Y}
if [[ "$ans" =~ ^[Yy]$ ]]; then
  stripe logout >/dev/null 2>&1 || true
  ok "로그아웃 완료 (또는 이미 비어있음)"
fi

step "2. 새 Stripe 계정으로 로그인"
hint "브라우저에서 페어링 코드를 확인하고 '계속'을 눌러주세요."
hint "다른 계정으로 들어가려면 브라우저에서 먼저 그 계정으로 로그인 해두세요."
stripe login

# 로그인 성공 후 어떤 계정 / 모드인지 확인
ACCOUNT_INFO=$(stripe config --list 2>/dev/null || true)
ACCOUNT_ID=$(stripe accounts retrieve 2>/dev/null | jq -r '.id // empty' 2>/dev/null || true)
if [ -z "$ACCOUNT_ID" ]; then
  err "Stripe 계정 확인에 실패했습니다. 'stripe login'을 다시 실행해주세요."
  exit 1
fi
ok "현재 계정: $ACCOUNT_ID"

# ── 2. 제품 + 가격 생성 ────────────────────────────────────────────────
# Strategy: search by name first to make this re-runnable.
find_or_create_product() {
  local name="$1"
  local existing
  existing=$(stripe products list --limit 100 \
    | jq -r --arg n "$name" '.data[] | select(.name == $n and (.active == true)) | .id' \
    | head -n 1 || true)
  if [ -n "$existing" ]; then
    echo "$existing"
    return
  fi
  stripe products create \
    --name "$name" \
    -d "metadata[hithere_plan]=$2" \
    | jq -r '.id'
}

find_or_create_price() {
  local product_id="$1"
  local amount="$2"   # in cents
  local lookup_key="$3"
  local existing
  existing=$(stripe prices list --product "$product_id" --limit 100 \
    | jq -r --arg a "$amount" --arg lk "$lookup_key" \
        '.data[]
           | select(
               .active == true
               and .unit_amount == ($a | tonumber)
               and .recurring.interval == "month"
               and .currency == "usd"
               and (.lookup_key == $lk or .lookup_key == null)
             )
           | .id' \
    | head -n 1 || true)
  if [ -n "$existing" ]; then
    echo "$existing"
    return
  fi
  stripe prices create \
    --product "$product_id" \
    --unit-amount "$amount" \
    --currency usd \
    -d "recurring[interval]=month" \
    -d "lookup_key=$lookup_key" \
    | jq -r '.id'
}

step "3. 제품 + 가격 생성 (idempotent — 이미 있으면 재사용)"

PRO_PRODUCT=$(find_or_create_product "hithere Pro" "pro")
PROFESSIONAL_PRODUCT=$(find_or_create_product "hithere Professional" "professional")
ok "Pro product:          $PRO_PRODUCT"
ok "Professional product: $PROFESSIONAL_PRODUCT"

PRO_PRICE=$(find_or_create_price "$PRO_PRODUCT" 999 "hithere_pro_monthly")
PROFESSIONAL_PRICE=$(find_or_create_price "$PROFESSIONAL_PRODUCT" 3999 "hithere_professional_monthly")
ok "Pro price            \$9.99/mo  → $PRO_PRICE"
ok "Professional price   \$39.99/mo → $PROFESSIONAL_PRICE"

set_env STRIPE_PRICE_PRO "$PRO_PRICE"
set_env STRIPE_PRICE_PROFESSIONAL "$PROFESSIONAL_PRICE"
ok ".env.local에 STRIPE_PRICE_PRO / STRIPE_PRICE_PROFESSIONAL 자동 기입 완료"

# ── 3. 나머지 값은 인터랙티브로 ────────────────────────────────────────
step "4. 나머지 시크릿 채우기"
hint "이어서 setup-env.sh를 실행합니다. 이미 채워진 값은 Enter로 넘기세요."
sleep 1
bash "$SCRIPT_DIR/setup-env.sh"

echo
step "5. 'stripe listen' 띄우는 법"
cat <<EOF
다른 터미널에서 ↓를 실행하세요. 화면에 출력되는 ${YELLOW}whsec_…${RESET}을
STRIPE_WEBHOOK_SECRET에 채워주세요 (setup-env.sh 재실행 가능).

    ${BOLD}stripe listen --forward-to localhost:3100/api/stripe/webhook${RESET}
EOF

step "완료"
ok ".env.local 위치: $ENV_FILE"
