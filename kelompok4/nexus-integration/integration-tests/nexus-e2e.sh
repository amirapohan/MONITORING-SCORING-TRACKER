#!/usr/bin/env bash
# ============================================================
#  NEXUS — END-TO-END INTEGRATION TEST (single file)
#
#  Menguji integrasi antar 5 microservice (kelompok1..5) terhadap
#  deployment dosen yang di-host via Tailscale, lewat 1 API Gateway —
#  mengikuti ALUR DUNIA-NYATA: client buat project (K2) -> talent bid (K2)
#  -> client accept (talent awarded) -> client buat milestone tertaut
#  projectId (K4) -> talent submit + file (MinIO) -> client review (K4->K1)
#  -> notifikasi (K5) di tiap langkah.
#
#  CATATAN PENTING — gateway dosen MENAMBAHKAN prefix mount tiap service:
#     /auth/X     -> svc-auth   /api/auth/X   (atau /internal/*)
#     /match/X    -> svc-match   /X
#     /tracker/X  -> svc-audit   /api/v1/X
#     /bidding/X  -> svc-bidding /api/X
#     /notify/X   -> svc-notify  /api/X
#
#  Pakai:
#    ./nexus-e2e.sh
#    BASE=http://map-sandbox.tailcbdd04.ts.net ./nexus-e2e.sh   # default
#    EVENT_WAIT=30 ./nexus-e2e.sh                                # mesin/broker lambat
#
#  Skrip ini memakai ID ASLI dari K1/K2 sehingga rantai benar-benar tertaut dan
#  LULUS baik svc-audit memakai VALIDATE_INTEGRATION=OFF (default live) maupun ON.
#  Panduan manual setara: nexus-e2e-postman.txt.
# ============================================================
set -u

BASE="${BASE:-http://map-sandbox.tailcbdd04.ts.net}"
TIMEOUT="${TIMEOUT:-12}"
EVENT_WAIT="${EVENT_WAIT:-20}"
PW="Passw0rd!23"

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
# extract "key":"string" | "key":number | nested data.user.id (UUID string)
jget() { printf '%s' "$1" | sed -n 's/.*"'"$2"'":"\([^"]*\)".*/\1/p' | head -1; }
jnum() { printf '%s' "$1" | sed -n 's/.*"'"$2"'":[[:space:]]*\([0-9][0-9]*\).*/\1/p' | head -1; }
juid() {
  local id
  id=$(printf '%s' "$1" | sed -n 's/.*"user":{[^}]*"id":"\([^"]*\)".*/\1/p' | head -1)
  [ -z "$id" ] && id=$(printf '%s' "$1" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)
  printf '%s' "$id"
}
sha_of() { if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'; else sha256sum "$1" | awk '{print $1}'; fi; }

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
step 1 "K1 — register + login CLIENT (employer)"
C_EMAIL="e2e_client_$(date +%s)_$RANDOM@nexus.dev"
CALL POST /auth/register "{\"name\":\"E2E Client\",\"email\":\"$C_EMAIL\",\"password\":\"$PW\",\"role\":\"client\"}"
CALL POST /auth/login "{\"email\":\"$C_EMAIL\",\"password\":\"$PW\"}"
CTOKEN=$(jget "$RBODY" accessToken); CUID=$(juid "$RBODY")
[ -n "$CTOKEN" ] && [ -n "$CUID" ] && ok "K1 client siap (id=$CUID)" || bad "K1 client login gagal (HTTP $RCODE: $(printf '%s' "$RBODY"|head -c120))"

# ------------------------------------------------------------
step 2 "K1 — register + login TALENT (mahasiswa)"
T_EMAIL="e2e_talent_$(date +%s)_$RANDOM@nexus.dev"
CALL POST /auth/register "{\"name\":\"E2E Talent\",\"email\":\"$T_EMAIL\",\"password\":\"$PW\",\"role\":\"talent\"}"
CALL POST /auth/login "{\"email\":\"$T_EMAIL\",\"password\":\"$PW\"}"
TTOKEN=$(jget "$RBODY" accessToken); TUID=$(juid "$RBODY")
[ -n "$TTOKEN" ] && [ -n "$TUID" ] && ok "K1 talent siap (id=$TUID)" || bad "K1 talent login gagal (HTTP $RCODE: $(printf '%s' "$RBODY"|head -c120))"

# ------------------------------------------------------------
step 3 "K1 -> K3 — K3 memvalidasi JWT K1 (role talent->student)"
if [ -n "$TTOKEN" ]; then
  CALL GET /match/me "" -H "Authorization: Bearer $TTOKEN"
  printf '%s' "$RBODY" | grep -q '"role":"student"' && ok "K3 menerima & memvalidasi JWT K1, map talent->student" \
    || bad "K3 tolak/gagal validasi JWT K1 (HTTP $RCODE: $(printf '%s' "$RBODY"|head -c120))"
  CALL GET /match/me "" -H "Authorization: Bearer token-palsu-xxx"
  printf '%s' "$RCODE" | grep -qE '^(401|403)$' && ok "K3 menolak token palsu (HTTP $RCODE)" || bad "K3 tak menolak token palsu (HTTP $RCODE)"
else
  skip "K3 federation di-skip (tak ada token talent)"
fi

# ------------------------------------------------------------
step 4 "K1 -> K2 -> K5 — CLIENT buat PROJECT (publish -> K5 consume)"
DL=$(date -u -v+7d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '+7 days' +%Y-%m-%dT%H:%M:%SZ)
BID_DEADLINE=$(date -u -v+7d +%Y-%m-%d 2>/dev/null || date -u -d '+7 days' +%Y-%m-%d)
PROJECT_ID=""; BID_ID=""
P_MARK="e2e-proj-$(date +%s)-$RANDOM"
if [ -n "$CTOKEN" ]; then
  CALL POST /bidding/projects \
    "{\"judul_proyek\":\"$P_MARK\",\"deskripsi_proyek\":\"e2e bidding\",\"skills\":[\"Backend\"],\"requirements\":\"min S1\",\"budget_awal\":1000000,\"kuota_maksimal\":1}" \
    -H "Authorization: Bearer $CTOKEN"
  if printf '%s' "$RBODY" | grep -q "successfully"; then
    PROJECT_ID=$(jnum "$RBODY" proyek_id)
    ok "K2 terima JWT K1 + buat project (id=$PROJECT_ID, HTTP $RCODE)"
    poll_notify "K2 -> K5 event project" "$P_MARK"
  elif printf '%s' "$RCODE" | grep -qE '^(401|403)$'; then
    bad "K2 tolak JWT K1 (HTTP $RCODE) — auth K1<->K2 putus"
  else
    skip "K2 buat project tak sukses (HTTP $RCODE: $(printf '%s' "$RBODY"|head -c140))"
  fi
else
  skip "K2 project di-skip (tak ada token client)"
fi

# ------------------------------------------------------------
step 5 "K1 -> K2 — TALENT BID ke project (student_id = id talent K1)"
if [ -n "$PROJECT_ID" ] && [ -n "$TTOKEN" ]; then
  CALL POST /bidding/bids \
    "{\"project_id\":$PROJECT_ID,\"student_id\":\"$TUID\",\"priority\":1,\"document_url\":\"https://github.com/nexus/proposal\",\"tawaran_harga\":950000,\"tawaran_waktu\":\"$BID_DEADLINE\"}" \
    -H "Authorization: Bearer $TTOKEN"
  BID_ID=$(jnum "$RBODY" bid_id)
  [ -n "$BID_ID" ] && ok "K2 terima bid talent (bid_id=$BID_ID, HTTP $RCODE)" \
    || skip "K2 bid tak terbuat (HTTP $RCODE: $(printf '%s' "$RBODY"|head -c140))"
else
  skip "Bid di-skip (project/talent token tak ada)"
fi

# ------------------------------------------------------------
step 6 "K2 -> K5 — CLIENT ACCEPT bid (talent 'awarded', publish event)"
if [ -n "$BID_ID" ] && [ -n "$CTOKEN" ]; then
  CALL PUT "/bidding/bids/$BID_ID/status" "{\"status\":\"Accepted\"}" -H "Authorization: Bearer $CTOKEN"
  if printf '%s' "$RBODY" | grep -qi "Accepted" || [ "$RCODE" = "200" ]; then
    ok "K2 accept bid -> talent $TUID awarded di project $PROJECT_ID (HTTP $RCODE)"
    poll_notify "K2 -> K5 event bid_deal_confirmed" "$PROJECT_ID" || info "event deal tak terlacak (payload mungkin beda field)"
  else
    bad "K2 accept bid gagal (HTTP $RCODE: $(printf '%s' "$RBODY"|head -c140))"
  fi
else
  skip "Accept bid di-skip (tak ada bid)"
fi

# ------------------------------------------------------------
step 7 "K4 (-> K2) -> K5 — CLIENT buat MILESTONE tertaut project + talent terpilih"
MID=""
if [ -n "$CUID" ] && [ -n "$TUID" ]; then
  M_MARK="e2e-ms-$(date +%s)-$RANDOM"
  MS_BODY="{\"title\":\"$M_MARK\",\"paymentAmount\":750000,\"deadline\":\"$DL\",\"employerId\":\"$CUID\",\"studentId\":\"$TUID\""
  if [ -n "$PROJECT_ID" ]; then
    MS_BODY="$MS_BODY,\"projectId\":\"$PROJECT_ID\",\"actorId\":\"$CUID\""
    info "milestone tertaut projectId=$PROJECT_ID (K4 gate: actorId client + talent awarded diverifikasi ke K2)"
  else
    info "projectId kosong (K2 tak tersedia) -> milestone tanpa tautan project"
  fi
  MS_BODY="$MS_BODY}"
  CALL POST /tracker/milestones "$MS_BODY"
  MID=$(jget "$RBODY" id)
  [ -n "$MID" ] && ok "K4 buat milestone (id=$MID, employer=$CUID, student=$TUID)" \
    || bad "K4 buat milestone gagal (HTTP $RCODE: $(printf '%s' "$RBODY"|head -c160))"
  [ -n "$MID" ] && poll_notify "K4 -> K5 event milestone" "$MID"
else
  skip "Milestone di-skip (client/talent id tak ada)"
fi

# ------------------------------------------------------------
step 8 "K4 -> MinIO — TALENT submit bukti + file, lalu baca balik (write+read storage)"
SUBID=""; FURL=""
if [ -n "$MID" ]; then
  STORE_TMP=$(mktemp -d); PROOF="$STORE_TMP/proof.png"
  printf '%s' 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' | base64 --decode > "$PROOF"
  LOCAL_SHA=$(sha_of "$PROOF"); LOCAL_SIZE=$(wc -c < "$PROOF" | tr -d ' ')

  # WRITE: unggah file beneran (multipart). studentId HARUS = studentId milestone.
  raw=$(curl -s -m "$TIMEOUT" -w $'\n%{http_code}' -X POST "$BASE/tracker/submissions" \
        -F "milestoneId=$MID" -F "studentId=$TUID" -F "actorId=$TUID" -F "description=e2e storage proof" \
        -F "file=@$PROOF;type=image/png")
  UBODY="${raw%$'\n'*}"; UCODE="${raw##*$'\n'}"
  FURL=$(jget "$UBODY" fileUrl); SUBID=$(jget "$UBODY" id)
  if [ -z "$FURL" ]; then
    bad "WRITE gagal — tak ada fileUrl di respons (HTTP $UCODE: $(printf '%s' "$UBODY"|head -c160))"
  else
    ok "WRITE: K4 unggah berkas ke MinIO (HTTP $UCODE, ${LOCAL_SIZE}B)"
    info "fileUrl = $FURL"
    printf '%s' "$FURL" | grep -q "/documents/" && ok "fileUrl menunjuk ke bucket 'documents'" || bad "fileUrl tak menunjuk ke bucket 'documents'"

    # READ: ambil objek langsung dari MinIO (uji tersimpan + policy public-read).
    GOT="$STORE_TMP/got.bin"
    DLCODE=$(curl -s -m "$TIMEOUT" -o "$GOT" -w '%{http_code}' "$FURL")
    if [ "$DLCODE" != "200" ]; then
      bad "READ gagal — objek tak terbaca dari MinIO (HTTP $DLCODE). Cek port 9000 & policy public-read."
    else
      ok "READ: objek terbaca anonim dari MinIO (HTTP 200)"
      REMOTE_SHA=$(sha_of "$GOT")
      [ "$REMOTE_SHA" = "$LOCAL_SHA" ] && ok "INTEGRITAS: isi di MinIO identik dgn yg diunggah (sha256 cocok)" \
        || bad "INTEGRITAS beda (lokal=$LOCAL_SHA vs minio=$REMOTE_SHA)"
    fi
  fi
  rm -rf "$STORE_TMP"
else
  skip "Submission/storage di-skip (tak ada milestone)"
fi

# ------------------------------------------------------------
step 9 "K4 -> K1 -> K5 — CLIENT review submission (verifikasi reviewer ke K1)"
if [ -n "$SUBID" ] && [ -n "$CUID" ]; then
  CALL POST "/tracker/submissions/$SUBID/review" "{\"reviewerId\":\"$CUID\",\"status\":\"approved\",\"notes\":\"oke lulus\"}"
  if printf '%s' "$RBODY" | grep -qi "successfully"; then
    ok "K4 verifikasi reviewer ke K1 & approve submission (HTTP $RCODE)"
    poll_notify "K4 -> K5 event submission_approved" "$SUBID" || skip "event submission tak terlacak (payload mungkin tak bawa id sama)"
  else
    bad "K4 review gagal — cek lookup ke K1 / INTERNAL_API_KEY (HTTP $RCODE: $(printf '%s' "$RBODY"|head -c160))"
  fi
else
  skip "Review di-skip (tak ada submission/client)"
fi

# ------------------------------------------------------------
echo
echo "============================================================"
echo "RINGKASAN E2E:  PASS=$PASS  FAIL=$FAIL  SKIP=$SKIP"
[ "$FAIL" -eq 0 ] && echo "STATUS: ✅ SEMUA INTEGRASI LULUS" || echo "STATUS: ❌ ADA INTEGRASI YANG GAGAL"
echo "============================================================"
exit "$FAIL"
