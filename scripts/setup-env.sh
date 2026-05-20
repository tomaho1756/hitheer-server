#!/usr/bin/env bash
#
# Interactive env filler for hithere apps/web/.env.local.
# Walks the user through Stripe + Firebase Admin keys, preserving any existing
# values (you can press Enter to keep what's there). Writes back the merged file
# with all original keys intact, then optionally launches stripe listen so the
# webhook secret can be captured in the next run.
#
# Usage:
#   bash scripts/setup-env.sh
#   # or
#   ./scripts/setup-env.sh

set -euo pipefail

# Resolve paths relative to repo root, regardless of where the script is run from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/apps/web/.env.local"

# ── color helpers (no-op if not a TTY) ────────────────────────────────────
if [ -t 1 ]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'
  RED=$'\033[31m'; CYAN=$'\033[36m'; RESET=$'\033[0m'
else
  BOLD=""; DIM=""; GREEN=""; YELLOW=""; RED=""; CYAN=""; RESET=""
fi

step()  { printf "\n${BOLD}${CYAN}▸ %s${RESET}\n" "$*"; }
hint()  { printf "${DIM}%s${RESET}\n" "$*"; }
ok()    { printf "${GREEN}✓ %s${RESET}\n" "$*"; }
warn()  { printf "${YELLOW}! %s${RESET}\n" "$*"; }
err()   { printf "${RED}✗ %s${RESET}\n" "$*"; }

mkdir -p "$(dirname "$ENV_FILE")"
touch "$ENV_FILE"

# Read current value of a key (handles quoted values + leading/trailing spaces).
get_env() {
  local key="$1"
  # Take the LAST occurrence (in case the file has duplicates).
  local line
  line=$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -n 1 || true)
  if [ -z "$line" ]; then printf ""; return; fi
  # Strip key= prefix.
  local val="${line#${key}=}"
  # Strip surrounding single or double quotes.
  if [[ "$val" =~ ^\'(.*)\'$ ]]; then val="${BASH_REMATCH[1]}"; fi
  if [[ "$val" =~ ^\"(.*)\"$ ]]; then val="${BASH_REMATCH[1]}"; fi
  printf "%s" "$val"
}

# Set/upsert a key. If the value contains anything tricky (spaces, JSON, etc.)
# we wrap it in single quotes. Existing duplicate lines for the same key are
# removed first so we never end up with two.
set_env() {
  local key="$1"
  local val="$2"
  local tmp
  tmp=$(mktemp)
  # Remove existing lines for this key.
  grep -vE "^${key}=" "$ENV_FILE" > "$tmp" || true
  # Wrap value in single quotes; escape any single quotes inside.
  local escaped
  escaped="${val//\'/\'\\\'\'}"
  printf "%s='%s'\n" "$key" "$escaped" >> "$tmp"
  mv "$tmp" "$ENV_FILE"
}

# Count occurrences of a single char in a string.
count_char() {
  local s="$1"
  local c="$2"
  local stripped="${s//[^$c]/}"
  printf "%s" "${#stripped}"
}

# Read a JSON value smartly:
#   · If the user types a path (and the file exists) — read the file.
#   · Otherwise treat what they typed as the start of inline JSON and keep
#     reading lines until the {} braces balance out. Then auto-terminate.
# Returns the content via stdout. Empty stdout = user pressed Enter to keep.
read_json_value() {
  local first
  read -r -p "→ " first || true
  if [ -z "$first" ]; then return; fi
  if [ "$first" = "-" ]; then
    printf "%s" "-"
    return
  fi

  # Path?
  local expanded="${first/#\~/$HOME}"
  if [ -f "$expanded" ]; then
    cat "$expanded"
    return
  fi

  # Inline JSON. Accumulate until { } balance.
  local acc="$first"
  local opens closes depth
  opens=$(count_char "$acc" '{')
  closes=$(count_char "$acc" '}')
  depth=$((opens - closes))

  # If they pasted the whole thing on one line we're done.
  if [ "$opens" -gt 0 ] && [ "$depth" -le 0 ]; then
    printf "%s" "$acc"
    return
  fi
  # If first line had no opening brace at all (likely garbage), just take it.
  if [ "$opens" -eq 0 ]; then
    printf "%s" "$acc"
    return
  fi

  local line
  while [ "$depth" -gt 0 ]; do
    if ! IFS= read -r line; then break; fi
    acc+=$'\n'"$line"
    opens=$(count_char "$acc" '{')
    closes=$(count_char "$acc" '}')
    depth=$((opens - closes))
  done
  printf "%s" "$acc"
}

# Prompt for a key. Args: key, label, hint, mode (visible|secret|json).
prompt_var() {
  local key="$1"
  local label="$2"
  local hint_text="$3"
  local mode="${4:-visible}"

  local current
  current=$(get_env "$key")

  printf "\n${BOLD}%s${RESET}\n" "$label"
  if [ -n "$hint_text" ]; then hint "$hint_text"; fi
  if [ -n "$current" ]; then
    local masked
    if [ ${#current} -gt 12 ]; then
      masked="${current:0:6}…${current: -4} (${#current} chars)"
    else
      masked="***"
    fi
    hint "현재: $masked   (Enter = 그대로 유지, '-' = 삭제)"
  fi

  local input=""
  case "$mode" in
    secret)
      read -r -s -p "→ " input || true
      echo
      ;;
    json)
      hint "방법 1) 파일 경로 입력 (예: ~/Downloads/hitheer-app-firebase-adminsdk.json)"
      hint "방법 2) JSON 전체를 붙여넣기 — { } 중괄호가 닫히면 자동 종료됩니다"
      input=$(read_json_value)
      ;;
    *)
      read -r -p "→ " input || true
      ;;
  esac

  if [ -z "$input" ]; then
    if [ -n "$current" ]; then
      ok "그대로 유지"
      return
    fi
    warn "빈 값으로 둠"
    return
  fi
  if [ "$input" = "-" ]; then
    set_env "$key" ""
    ok "삭제됨"
    return
  fi

  if [ "$mode" = "json" ]; then
    # Quick sanity: must parse as JSON if jq is available. Don't reject,
    # just warn so a typo doesn't silently brick the webhook.
    if command -v jq >/dev/null 2>&1; then
      if ! printf "%s" "$input" | jq -e . >/dev/null 2>&1; then
        warn "이 값이 유효한 JSON으로 파싱되지 않습니다 — 그래도 저장합니다"
      fi
    fi
    # Collapse newlines so the value survives single-line .env loading.
    input="${input//$'\n'/}"
  fi
  set_env "$key" "$input"
  ok "저장됨 (${#input} chars)"
}

clear
cat <<EOF
${BOLD}hithere · .env.local 인터랙티브 설정${RESET}

대상 파일: ${DIM}$ENV_FILE${RESET}

각 항목에서:
  · Enter      → 기존 값 유지
  · 값 입력    → 덮어쓰기
  · '-' 입력   → 값 삭제
  · JSON 모드  → 붙여넣고 마지막 줄에 ${BOLD}EOF${RESET} 입력
EOF

step "1/6  STRIPE_SECRET_KEY"
prompt_var \
  STRIPE_SECRET_KEY \
  "Stripe Secret Key" \
  "Stripe Dashboard → Developers → API keys → 'Secret key' (sk_test_… 또는 sk_live_…)" \
  secret

step "2/6  STRIPE_WEBHOOK_SECRET"
prompt_var \
  STRIPE_WEBHOOK_SECRET \
  "Stripe Webhook Signing Secret" \
  "로컬: 'stripe listen --forward-to localhost:3100/api/stripe/webhook' 실행 후 whsec_… 복사
운영: Dashboard → Developers → Webhooks → 해당 endpoint → 'Signing secret'" \
  secret

step "3/6  STRIPE_PRICE_PRO  (\$9.99 / month)"
prompt_var \
  STRIPE_PRICE_PRO \
  "Stripe Price ID — Pro" \
  "Dashboard → Products → 'Pro' Recurring \$9.99/mo USD → Price ID (price_…)"

step "4/6  STRIPE_PRICE_PROFESSIONAL  (\$39.99 / month)"
prompt_var \
  STRIPE_PRICE_PROFESSIONAL \
  "Stripe Price ID — Professional" \
  "Dashboard → Products → 'Professional' Recurring \$39.99/mo USD → Price ID (price_…)"

step "5/6  FIREBASE_ADMIN_SA_JSON"
prompt_var \
  FIREBASE_ADMIN_SA_JSON \
  "Firebase Admin Service Account JSON (전체 JSON 내용)" \
  "Firebase Console → 프로젝트 설정 → 서비스 계정 → '새 비공개 키 생성'으로 받은 .json 파일 전체를 복사해 붙여넣으세요" \
  json

step "6/6  NEXT_PUBLIC_SITE_ORIGIN"
prompt_var \
  NEXT_PUBLIC_SITE_ORIGIN \
  "Site Origin" \
  "로컬: http://localhost:3100   /   운영: https://hithere.dedyn.io 등"

# Final sanity: warn on anything still empty among the must-haves.
echo
step "확인"
required=(STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET STRIPE_PRICE_PRO STRIPE_PRICE_PROFESSIONAL FIREBASE_ADMIN_SA_JSON)
missing=()
for k in "${required[@]}"; do
  v=$(get_env "$k")
  if [ -z "$v" ]; then
    missing+=("$k")
  fi
done

if [ ${#missing[@]} -gt 0 ]; then
  warn "아래 키는 아직 비어 있어요 — 다시 실행하거나 직접 채우세요:"
  for k in "${missing[@]}"; do printf "    - %s\n" "$k"; done
else
  ok "필수 항목 모두 채워졌어요"
fi

echo
hint "저장 위치: $ENV_FILE"
hint "다음 단계 예:"
printf "  ${DIM}1) cd %s && pnpm dev${RESET}\n" "$REPO_ROOT/apps/web"
printf "  ${DIM}2) stripe listen --forward-to localhost:3100/api/stripe/webhook${RESET}\n"
printf "  ${DIM}3) cd %s && cargo run${RESET}\n" "$REPO_ROOT/apps/signaling"
echo
