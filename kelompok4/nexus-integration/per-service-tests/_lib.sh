# ============================================================
#  _lib.sh — helper bersama untuk per-service test suite
#  Di-source oleh tiap kN-*-test.sh (lihat README.txt)
# ============================================================
set -u

BASE="${BASE:-http://localhost}"
TIMEOUT="${TIMEOUT:-10}"
PASS=0; FAIL=0; SKIP=0; KBUG=0

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE="${COMPOSE:-$HERE/../docker-compose.yml}"

ok()    { echo "  ✅ PASS      - $1"; PASS=$((PASS+1)); }
bad()   { echo "  ❌ FAIL      - $1"; FAIL=$((FAIL+1)); }
skip()  { echo "  ⏭️  SKIP      - $1"; SKIP=$((SKIP+1)); }
kbug()  { echo "  🐞 KNOWN-BUG - $1"; KBUG=$((KBUG+1)); }
hr()    { echo "------------------------------------------------------------"; }

# CALL <method> <path> [json-body] [extra curl args...] -> sets RBODY, RCODE
CALL() {
  local m="$1" p="$2" body="${3:-}"; shift 3 2>/dev/null || shift $#
  local raw
  if [ -n "$body" ]; then
    raw=$(curl -s -m "$TIMEOUT" -w $'\n%{http_code}' -X "$m" "$BASE$p" \
            -H 'Content-Type: application/json' -d "$body" "$@")
  else
    raw=$(curl -s -m "$TIMEOUT" -w $'\n%{http_code}' -X "$m" "$BASE$p" "$@")
  fi
  RCODE="${raw##*$'\n'}"; RBODY="${raw%$'\n'*}"
}

# jval <json> <key>  -> first scalar value of "key":... (string or number)
jval() {
  printf '%s' "$1" | sed -n 's/.*"'"$2"'":"\([^"]*\)".*/\1/p' | head -1 \
    | grep . || printf '%s' "$1" | sed -n 's/.*"'"$2"'":\([0-9][0-9.]*\).*/\1/p' | head -1
}

# expect_body <desc> <needle>   (uses last RBODY)
expect_body() {
  if printf '%s' "$RBODY" | grep -q "$2"; then ok "$1"
  else bad "$1 (code=$RCODE resp: $(printf '%s' "$RBODY" | head -c 180))"; fi
}

# expect_code <desc> <regex-of-acceptable-codes>
expect_code() {
  if printf '%s' "$RCODE" | grep -qE "$2"; then ok "$1 (HTTP $RCODE)"
  else bad "$1 (HTTP $RCODE, expected $2; resp: $(printf '%s' "$RBODY" | head -c 140))"; fi
}

# Log container: nama container tetap "SVC-notify" (project nexus-svc-group),
# bukan service compose. Coba docker logs <SVC-xxx>, fallback compose.
dclogs() {
  local svc="$1" cn="${1/svc-/SVC-}"
  docker logs "$cn" 2>/dev/null \
    || docker logs "$svc" 2>/dev/null \
    || docker compose -f "$COMPOSE" logs "$svc" 2>&1
}

summary() {
  hr
  echo "RINGKASAN [$1]:  PASS=$PASS  FAIL=$FAIL  SKIP=$SKIP  KNOWN-BUG=$KBUG"
  [ "$FAIL" -eq 0 ] && echo "STATUS: ✅ TIDAK ADA KEGAGALAN TAK TERDUGA" \
                     || echo "STATUS: ❌ ADA KEGAGALAN"
  exit "$FAIL"
}

# register+login persona di K1 -> set PERSONA_TOKEN/PERSONA_UID/PERSONA_EMAIL
# Tahan rate-limit login K1 (10/15m): retry + backoff; kosong kalau gagal.
PERSONA_RATELIMITED=0
k1_persona() { # <role> <prefix>
  local role="$1" pfx="$2" email pw login code i
  email="${pfx}_$(date +%s)_$RANDOM@nexus.dev"; pw="Passw0rd!23"
  curl -s -m "$TIMEOUT" -o /dev/null -X POST "$BASE/auth/api/auth/register" \
        -H 'Content-Type: application/json' \
        -d "{\"name\":\"$pfx Persona\",\"email\":\"$email\",\"password\":\"$pw\",\"role\":\"$role\"}"
  PERSONA_TOKEN=""; PERSONA_UID=""; PERSONA_EMAIL="$email"
  for i in 1 2 3 4 5; do
    login=$(curl -s -m "$TIMEOUT" -w $'\n%{http_code}' -X POST "$BASE/auth/api/auth/login" \
          -H 'Content-Type: application/json' -d "{\"email\":\"$email\",\"password\":\"$pw\"}")
    code="${login##*$'\n'}"; login="${login%$'\n'*}"
    PERSONA_TOKEN=$(printf '%s' "$login" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
    PERSONA_UID=$(printf '%s' "$login" | sed -n 's/.*"user":{[^}]*"id":"\([^"]*\)".*/\1/p')
    [ -n "$PERSONA_TOKEN" ] && return 0
    if [ "$code" = "429" ]; then PERSONA_RATELIMITED=1; sleep 12; else sleep 2; fi
  done
  return 1
}
