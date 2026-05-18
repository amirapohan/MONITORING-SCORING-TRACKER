#!/usr/bin/env bash
# ============================================================
#  NEXUS — End-to-End Test
#  Jalankan SETELAH `docker compose up -d` dan semua container healthy.
#  Semua request lewat API Gateway tunggal: http://localhost
#
#  Pakai:
#    ./e2e-test.sh
#  (override base url) BASE=http://localhost ./e2e-test.sh
# ============================================================
set -u

BASE="${BASE:-http://localhost}"
PASS=0
FAIL=0

ok()   { echo "  ✅ PASS - $1"; PASS=$((PASS+1)); }
bad()  { echo "  ❌ FAIL - $1"; FAIL=$((FAIL+1)); }
hr()   { echo "------------------------------------------------------------"; }

# assert: <desc> <haystack> <needle>
assert_contains() {
  if printf '%s' "$2" | grep -q "$3"; then ok "$1"; else bad "$1 (resp: $(printf '%s' "$2" | head -c 160))"; fi
}

echo "NEXUS E2E — base=$BASE"
hr

# ---- [1] Gateway + health tiap service (Kelompok 1-5 + gateway) ----
echo "[1] Health gateway + 5 service"
assert_contains "Gateway /healthz"                 "$(curl -s -m5 $BASE/healthz)"                   "gateway ok"
assert_contains "K1 auth   /auth/health"           "$(curl -s -m5 $BASE/auth/health)"               '"status":"ok"'
assert_contains "K2 bidding /bidding/"             "$(curl -s -m5 $BASE/bidding/)"                  "layanan bidding"
assert_contains "K3 match  /match/health"          "$(curl -s -m5 $BASE/match/health)"              '"status":"ok"'
assert_contains "K4 tracker /tracker/api/v1/health" "$(curl -s -m5 $BASE/tracker/api/v1/health)"    '"status":"OK"'
assert_contains "K5 notify /notify/health"         "$(curl -s -m5 $BASE/notify/health)"             '"status":"ok"'
hr

# ---- [2] K1: register + login -> JWT nyata ----
echo "[2] K1 Identity & SSO: register + login (JWT)"
EMAIL="e2e_$(date +%s)@nexus.dev"
PASSWD="Passw0rd!23"
REG=$(curl -s -m10 -X POST $BASE/auth/api/auth/register -H 'Content-Type: application/json' \
  -d "{\"name\":\"E2E User\",\"email\":\"$EMAIL\",\"password\":\"$PASSWD\",\"role\":\"talent\"}")
assert_contains "K1 register user" "$REG" '"success":true'

LOGIN=$(curl -s -m10 -X POST $BASE/auth/api/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWD\"}")
assert_contains "K1 login" "$LOGIN" '"accessToken"'
TOKEN=$(printf '%s' "$LOGIN" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
[ -n "$TOKEN" ] && ok "K1 JWT diterima (len=${#TOKEN})" || bad "K1 JWT kosong"
hr

# ---- [3] K3: endpoint terproteksi, validasi JWT lintas-service ke K1 ----
echo "[3] K3 Team Matching: /match/me pakai JWT (validasi ke K1)"
ME=$(curl -s -m10 $BASE/match/me -H "Authorization: Bearer $TOKEN")
assert_contains "K3 menerima & memvalidasi JWT K1" "$ME" "\"student_id\""
assert_contains "K3 role mapping talent->student"  "$ME" '"role":"student"'
echo "  (resp: $(printf '%s' "$ME" | head -c 160))"
hr

# ---- [4] K4: buat milestone -> publish event ke RabbitMQ ----
echo "[4] K4 Tracker: create milestone (publish ke RabbitMQ outbox)"
DL=$(date -u -v+7d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '+7 days' +%Y-%m-%dT%H:%M:%SZ)
MS=$(curl -s -m10 -X POST $BASE/tracker/api/v1/milestones -H 'Content-Type: application/json' \
  -d "{\"title\":\"E2E Milestone\",\"paymentAmount\":500000,\"deadline\":\"$DL\",\"employerId\":\"emp-e2e\",\"studentId\":\"stu-e2e\"}")
assert_contains "K4 milestone dibuat (Prisma)" "$MS" '"id"'
MID=$(printf '%s' "$MS" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
echo "  milestoneId=$MID"
hr

# ---- [5] K5: consume event milestone dari RabbitMQ ----
echo "[5] K5 Notification: consume event tracker dari RabbitMQ"
sleep 4
LOGS=$(docker compose logs svc-notify 2>&1 | grep -i "event received" | tail -3)
if printf '%s' "$LOGS" | grep -q "milestone.created"; then
  ok "K5 consume event tracker.milestone.created"
  echo "  $(printf '%s' "$LOGS" | tail -1)"
else
  bad "K5 tidak terlihat consume event (cek: docker compose logs svc-notify)"
fi
hr

# ---- Ringkasan ----
echo "RINGKASAN:  PASS=$PASS  FAIL=$FAIL"
[ "$FAIL" -eq 0 ] && echo "STATUS: ✅ SEMUA LULUS" || echo "STATUS: ❌ ADA YANG GAGAL"
exit $FAIL
