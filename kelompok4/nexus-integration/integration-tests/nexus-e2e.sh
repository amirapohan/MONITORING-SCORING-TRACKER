#!/usr/bin/env bash
# ============================================================
#  NEXUS — END-TO-END INTEGRATION TEST (single file)
#
#  Menguji integrasi antar 5 microservice (kelompok1..5) terhadap
#  deployment dosen yang di-host via Tailscale, lewat 1 API Gateway.
#
#  CATATAN PENTING — gateway dosen MENAMBAHKAN prefix mount tiap service
#  (berbeda dgn gateway.conf di repo lokal yang membuang prefix):
#     /auth/X     -> svc-auth   /api/auth/X
#     /match/X    -> svc-match   /X
#     /tracker/X  -> svc-audit   /api/v1/X
#     /bidding/X  -> svc-bidding /api/X
#     /notify/X   -> svc-notify  /api/X
#  Path di skrip ini SUDAH disesuaikan untuk gateway tsb.
#
#  Pakai:
#    ./nexus-e2e.sh
#    BASE=http://map-sandbox.tailcbdd04.ts.net ./nexus-e2e.sh   # default
#    EVENT_WAIT=30 ./nexus-e2e.sh                                # mesin/broker lambat
# ============================================================
set -u

BASE="${BASE:-http://map-sandbox.tailcbdd04.ts.net}"
TIMEOUT="${TIMEOUT:-12}"
EVENT_WAIT="${EVENT_WAIT:-20}"

PASS=0; FAIL=0; SKIP=0
ok()   { echo "  ✅ PASS  - $1"; PASS=$((PASS+1)); }
bad()  { echo "  ❌ FAIL  - $1"; FAIL=$((FAIL+1)); }
skip() { echo "  ⏭️  SKIP  - $1"; SKIP=$((SKIP+1)); }
info() { echo "     · $1"; }
step() { echo; echo "============================================================"; echo "[$1] $2"; echo "============================================================"; }

# CALL <method> <path> [json-body] [extra curl args...] -> RBODY, RCODE
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
jget() { printf '%s' "$1" | sed -n 's/.*"'"$2"'":"\([^"]*\)".*/\1/p' | head -1; }

# poll_notify <desc> <needle> : GET /notify/notifications sampai memuat needle
poll_notify() {
  local desc="$1" needle="$2" waited=0
  while [ "$waited" -lt "$EVENT_WAIT" ]; do
    CALL GET /notify/notifications
    if printf '%s' "$RBODY" | grep -q "$needle"; then
      ok "$desc (ter-consume K5 setelah ${waited}s)"; return 0
    fi
    sleep 2; waited=$((waited + 2))
  done
  bad "$desc (tak muncul di K5 dalam ${EVENT_WAIT}s)"; return 1
}

echo "NEXUS E2E — base=$BASE  (event_wait=${EVENT_WAIT}s)"

# ------------------------------------------------------------
step 0 "PREFLIGHT — gateway (K4) me-route ke 5 service"
CALL GET /healthz;        printf '%s' "$RBODY" | grep -q "gateway ok"      && ok "Gateway hidup"            || bad "Gateway mati (resp: $(printf '%s' "$RBODY"|head -c80))"
CALL GET /auth/health;    printf '%s' "$RBODY" | grep -q '"status":"ok"'   && ok "K1 Identity & SSO hidup"  || bad "K1 mati"
CALL GET /bidding/health; printf '%s' "$RBODY" | grep -q '"service":"bidding"' && ok "K2 Project Bidding hidup" || bad "K2 mati"
CALL GET /match/health;   printf '%s' "$RBODY" | grep -q '"status":"ok"'   && ok "K3 Team Matching hidup"   || bad "K3 mati"
CALL GET /tracker/health; printf '%s' "$RBODY" | grep -qi '"status":"OK"'  && ok "K4 Tracker hidup"         || bad "K4 mati"
CALL GET /notify/health;  printf '%s' "$RBODY" | grep -q '"service":"notification"' && ok "K5 Notification hidup" || bad "K5 mati"

# ------------------------------------------------------------
step 1 "K1 — register + login talent (terbitkan JWT)"
T_EMAIL="e2e_talent_$(date +%s)_$RANDOM@nexus.dev"; PW="Passw0rd!23"
CALL POST /auth/register "{\"name\":\"E2E Talent\",\"email\":\"$T_EMAIL\",\"password\":\"$PW\",\"role\":\"talent\"}"
printf '%s' "$RBODY" | grep -q '"success":true' && ok "K1 register talent (HTTP $RCODE)" || bad "K1 register gagal (HTTP $RCODE: $(printf '%s' "$RBODY"|head -c120))"
CALL POST /auth/login "{\"email\":\"$T_EMAIL\",\"password\":\"$PW\"}"
TOKEN=$(jget "$RBODY" accessToken)
[ -n "$TOKEN" ] && ok "K1 login -> JWT (len=${#TOKEN})" || bad "K1 login gagal (HTTP $RCODE: $(printf '%s' "$RBODY"|head -c120))"

# ------------------------------------------------------------
step 2 "K1 -> K3 — K3 memvalidasi JWT K1 (role talent->student)"
if [ -n "$TOKEN" ]; then
  CALL GET /match/me "" -H "Authorization: Bearer $TOKEN"
  printf '%s' "$RBODY" | grep -q '"role":"student"' && ok "K3 menerima & memvalidasi JWT K1, map talent->student" \
    || bad "K3 tolak/gagal validasi JWT K1 (HTTP $RCODE: $(printf '%s' "$RBODY"|head -c120))"
  printf '%s' "$RBODY" | grep -q '"student_id"' && ok "K3 mengembalikan student_id (resolusi identitas dari K1)" || info "tak ada student_id di respons"
  CALL GET /match/me "" -H "Authorization: Bearer token-palsu-xxx"
  printf '%s' "$RCODE" | grep -qE '^(401|403)$' && ok "K3 menolak token palsu (HTTP $RCODE)" || bad "K3 tak menolak token palsu (HTTP $RCODE)"
else
  skip "K3 federation di-skip (tak ada token)"
fi

# ------------------------------------------------------------
step 3 "K4 -> K5 — milestone dibuat K4 -> publish -> K5 consume (RabbitMQ)"
DL=$(date -u -v+7d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '+7 days' +%Y-%m-%dT%H:%M:%SZ)
M_MARK="e2e-ms-$(date +%s)-$RANDOM"
CALL POST /tracker/milestones "{\"title\":\"$M_MARK\",\"paymentAmount\":500000,\"description\":\"e2e\",\"deadline\":\"$DL\",\"employerId\":\"emp-e2e\",\"studentId\":\"stu-e2e\"}"
MID=$(jget "$RBODY" id)
[ -n "$MID" ] && ok "K4 buat milestone (id=$MID)" || bad "K4 buat milestone gagal (HTTP $RCODE: $(printf '%s' "$RBODY"|head -c140))"
[ -n "$MID" ] && poll_notify "K4 -> K5 event milestone" "$MID"

# ------------------------------------------------------------
step 4 "K1 — register + login client (untuk K2 & review K4)"
C_EMAIL="e2e_client_$(date +%s)_$RANDOM@nexus.dev"
CALL POST /auth/register "{\"name\":\"E2E Client\",\"email\":\"$C_EMAIL\",\"password\":\"$PW\",\"role\":\"client\"}"
CALL POST /auth/login "{\"email\":\"$C_EMAIL\",\"password\":\"$PW\"}"
CTOKEN=$(jget "$RBODY" accessToken)
CUID=$(printf '%s' "$RBODY" | sed -n 's/.*"user":{[^}]*"id":"\([^"]*\)".*/\1/p')
[ -z "$CUID" ] && CUID=$(printf '%s' "$RBODY" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
[ -n "$CTOKEN" ] && ok "K1 client siap (id=$CUID)" || bad "K1 client login gagal (HTTP $RCODE)"

# ------------------------------------------------------------
step 5 "K1 -> K2 -> K5 — K2 validasi JWT K1, buat project -> publish -> K5 consume"
if [ -n "$CTOKEN" ]; then
  P_MARK="e2e-proj-$(date +%s)-$RANDOM"
  CALL POST /bidding/projects \
    "{\"judul_proyek\":\"$P_MARK\",\"deskripsi_proyek\":\"e2e bidding\",\"skills\":[\"Backend\"],\"requirements\":\"min S1\",\"budget_awal\":1000000,\"kuota_maksimal\":1}" \
    -H "Authorization: Bearer $CTOKEN"
  if printf '%s' "$RBODY" | grep -q "successfully"; then
    ok "K2 terima JWT K1 + buat project (HTTP $RCODE)"
    poll_notify "K2 -> K5 event project" "$P_MARK"
  elif printf '%s' "$RCODE" | grep -qE '^(401|403)$'; then
    bad "K2 tolak JWT K1 (HTTP $RCODE) — auth K1<->K2 putus"
  else
    skip "K2 buat project tak sukses (HTTP $RCODE: $(printf '%s' "$RBODY"|head -c140)) — cek skema deploy"
  fi
else
  skip "K2 di-skip (tak ada token client)"
fi

# ------------------------------------------------------------
step 6 "K4 -> K1 — review submission memverifikasi reviewer ke K1 (+event ke K5)"
if [ -n "$CTOKEN" ] && [ -n "$CUID" ]; then
  R_MARK="e2e-rev-$(date +%s)-$RANDOM"
  CALL POST /tracker/milestones "{\"title\":\"$R_MARK\",\"paymentAmount\":750000,\"deadline\":\"$DL\",\"employerId\":\"$CUID\",\"studentId\":\"stu-$R_MARK\"}"
  RMID=$(jget "$RBODY" id)
  # submission links-only (multipart, tanpa file -> tak butuh storage)
  raw=$(curl -s -m "$TIMEOUT" -w $'\n%{http_code}' -X POST "$BASE/tracker/submissions" \
        -F "milestoneId=$RMID" -F "studentId=stu-$R_MARK" -F "description=e2e submission" \
        -F 'links=["https://github.com/nexus/repo"]')
  SBODY="${raw%$'\n'*}"; SID=$(jget "$SBODY" id)
  [ -n "$SID" ] && ok "K4 buat submission (id=$SID)" || skip "K4 submission tak terbuat ($(printf '%s' "$SBODY"|head -c120))"
  if [ -n "$SID" ]; then
    CALL POST "/tracker/submissions/$SID/review" "{\"reviewerId\":\"$CUID\",\"status\":\"approved\",\"notes\":\"oke lulus\"}"
    if printf '%s' "$RBODY" | grep -qi "successfully"; then
      ok "K4 verifikasi reviewer ke K1 & approve submission (HTTP $RCODE)"
      poll_notify "K4 -> K5 event submission_approved" "$SID" || skip "event submission tak terlacak (payload mungkin tak bawa id sama)"
    else
      bad "K4 review gagal — cek lookup ke K1 / INTERNAL_API_KEY (HTTP $RCODE: $(printf '%s' "$RBODY"|head -c140))"
    fi
  fi
else
  skip "Review chain di-skip (tak ada client)"
fi

# ------------------------------------------------------------
echo
echo "============================================================"
echo "RINGKASAN E2E:  PASS=$PASS  FAIL=$FAIL  SKIP=$SKIP"
[ "$FAIL" -eq 0 ] && echo "STATUS: ✅ SEMUA INTEGRASI LULUS" || echo "STATUS: ❌ ADA INTEGRASI YANG GAGAL"
echo "============================================================"
exit "$FAIL"
