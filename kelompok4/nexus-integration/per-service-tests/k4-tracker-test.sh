#!/usr/bin/env bash
# ============================================================
#  K4 — Monitoring & Scoring (Tracker) : SEMUA endpoint via /tracker
#  Lihat: k4-tracker-features.txt
# ============================================================
. "$(cd "$(dirname "$0")" && pwd)/_lib.sh"
echo "K4 Tracker — base=$BASE"; hr

DL=$(date -u -v+7d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '+7 days' +%Y-%m-%dT%H:%M:%SZ)
TEAM="team-k4-$(date +%s)"
STU="stu-k4-$(date +%s)"

# multipart helper -> set RBODY/RCODE
MPART() { local m="$1" p="$2"; shift 2
  local raw; raw=$(curl -s -m "$TIMEOUT" -w $'\n%{http_code}' -X "$m" "$BASE$p" "$@")
  RCODE="${raw##*$'\n'}"; RBODY="${raw%$'\n'*}"; }

# klien K1 sebagai employer (dipakai untuk submission review lintas-service)
k1_persona client k4emp; EMP_UID="$PERSONA_UID"
[ -n "$EMP_UID" ] && ok "K1 client persona siap (employerId=$EMP_UID)" \
  || skip "K1 client tak siap -> review submission akan di-SKIP"
[ -z "$EMP_UID" ] && EMP_UID="emp-k4-$(date +%s)"
hr

# --- health & docs ---
CALL GET /tracker/api/v1/health;  expect_body "GET /api/v1/health" '"status":"OK"'
CALL GET /tracker/api-docs;       expect_code "GET /api-docs (swagger UI)" '^(200|301|302)$'
hr

# --- milestones ---
CALL POST /tracker/api/v1/milestones \
  "{\"title\":\"K4 Milestone\",\"paymentAmount\":500000,\"description\":\"uji penuh\",\"deadline\":\"$DL\",\"employerId\":\"$EMP_UID\",\"studentId\":\"$STU\"}"
expect_body "POST /api/v1/milestones" "Milestone created successfully"
MID=$(printf '%s' "$RBODY" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
[ -n "$MID" ] && ok "milestoneId=$MID" || bad "milestoneId kosong"
CALL GET "/tracker/api/v1/milestones?studentId=$STU"; expect_body "GET /api/v1/milestones" "Milestones retrieved successfully"
CALL GET "/tracker/api/v1/milestones/$MID";           expect_body "GET /api/v1/milestones/:id" "Milestone retrieved successfully"
CALL PATCH "/tracker/api/v1/milestones/$MID" '{"title":"K4 Milestone (revisi)"}'
expect_body "PATCH /api/v1/milestones/:id" "Milestone updated successfully"
hr

# --- submissions (links-only: tanpa file -> tak butuh Supabase) ---
MPART POST /tracker/api/v1/submissions \
  -F "milestoneId=$MID" -F "studentId=$STU" -F "description=submission uji" \
  -F 'links=["https://github.com/nexus/repo"]'
expect_body "POST /api/v1/submissions (links-only)" "Submission created successfully"
SID=$(printf '%s' "$RBODY" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
CALL GET "/tracker/api/v1/submissions?milestoneId=$MID"; expect_body "GET /api/v1/submissions" "Submissions retrieved successfully"
CALL GET "/tracker/api/v1/submissions/$SID";             expect_body "GET /api/v1/submissions/:id" "Submission retrieved successfully"
CALL GET "/tracker/api/v1/submissions/$SID/download"
expect_code "GET /api/v1/submissions/:id/download (links-only -> 404 wajar)" '^404$'

# review submission: butuh K1 (reviewer=client==employerId) terjangkau dari K4
CALL POST "/tracker/api/v1/submissions/$SID/review" "{\"reviewerId\":\"$EMP_UID\",\"status\":\"approved\",\"notes\":\"oke\"}"
if printf '%s' "$RBODY" | grep -q "Submission review created successfully"; then
  ok "POST /api/v1/submissions/:id/review (lintas-service K1 OK)"
else
  skip "POST /api/v1/submissions/:id/review (butuh K1 internal + INTERNAL_API_KEY K4; resp code=$RCODE)"
fi
hr

# --- assessments -> lock -> NFT ---
CALL POST /tracker/api/v1/assessments \
  "{\"teamId\":\"$TEAM\",\"graderId\":\"grader-k4\",\"scoreArchitecture\":90,\"scoreImplementation\":85,\"scoreDocumentation\":80,\"scorePresentation\":88,\"finalScore\":86.5,\"notes\":\"bagus\"}"
expect_body "POST /api/v1/assessments" "Assessment created successfully"
AID=$(printf '%s' "$RBODY" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
CALL POST "/tracker/api/v1/assessments/$AID/lock"
expect_body "POST /api/v1/assessments/:id/lock (buat NFT)" "Assessment locked successfully"
CALL GET "/tracker/api/v1/assessments/team/$TEAM"
expect_body "GET /api/v1/assessments/team/:teamId" "Assessments retrieved successfully"
hr

# --- NFT (ada setelah lock) ---
CALL GET "/tracker/api/v1/nft/team/$TEAM"
expect_body "GET /api/v1/nft/team/:teamId" "NFT records retrieved successfully"
NID=$(printf '%s' "$RBODY" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
if [ -n "$NID" ]; then
  CALL GET "/tracker/api/v1/nft/$NID/verify"
  expect_body "GET /api/v1/nft/:id/verify" "NFT verification completed successfully"
else
  bad "NFT id tak ditemukan setelah lock"
fi
hr

# --- logbook ---
CALL POST /tracker/api/v1/logbook \
  "{\"teamId\":\"$TEAM\",\"authorId\":\"author-k4\",\"sprintNumber\":3,\"status\":\"in_progress\",\"description\":\"kerjakan modul X\"}"
expect_body "POST /api/v1/logbook" "Logbook created successfully"
CALL GET "/tracker/api/v1/logbook/team/$TEAM/latest"
expect_body "GET /api/v1/logbook/team/:teamId/latest" "Latest logbook retrieved successfully"
CALL GET "/tracker/api/v1/logbook/team/$TEAM"
expect_body "GET /api/v1/logbook/team/:teamId" "Logbooks retrieved successfully"
hr

# --- documents : butuh env SUPABASE_* (file wajib). Default di-SKIP ---
PDF="$(mktemp -t k4doc.XXXXXX).pdf"
printf '%%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%%%EOF\n' > "$PDF"
MPART POST /tracker/api/v1/documents \
  -F "teamId=$TEAM" -F "uploaderId=uploader-k4" -F "description=dok uji" \
  -F "file=@$PDF;type=application/pdf;filename=dok-uji.pdf"
rm -f "$PDF"
if printf '%s' "$RBODY" | grep -q "Document created successfully"; then
  ok "POST /api/v1/documents (Supabase terkonfigurasi)"
  DID=$(printf '%s' "$RBODY" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
  CALL GET "/tracker/api/v1/documents/$DID";          expect_body "GET /api/v1/documents/:id" "Document retrieved successfully"
  CALL GET "/tracker/api/v1/documents/$DID/download";  expect_body "GET /api/v1/documents/:id/download" "Document download link retrieved successfully"
  CALL GET "/tracker/api/v1/documents/team/$TEAM";     expect_body "GET /api/v1/documents/team/:teamId" "Documents retrieved successfully"
  CALL POST "/tracker/api/v1/documents/$DID/review" '{"reviewerId":"rev-k4","status":"approved","notes":"ok"}'
  expect_body "POST /api/v1/documents/:id/review" "Document review created successfully"
elif printf '%s' "$RBODY" | grep -qi "SUPABASE"; then
  skip "POST /api/v1/documents (env SUPABASE_* belum di-set -> 500 wajar)"
  skip "  -> documents/:id, /download, /team/:teamId, /:id/review (gated Supabase)"
  CALL GET "/tracker/api/v1/documents/team/$TEAM"
  expect_body "GET /api/v1/documents/team/:teamId (list tetap jalan)" "Documents retrieved successfully"
elif printf '%s' "$RBODY" | grep -q '"code":"VALIDATION_ERROR"'; then
  ok "POST /api/v1/documents TERJANGKAU + validasi jalan ($(printf '%s' "$RBODY" | sed -n 's/.*"message":"\([^"]*\)".*/\1/p'))"
  skip "  jalur upload sukses tak diuji (perlu PDF nyata + env SUPABASE_*)"
else
  bad "POST /api/v1/documents (code=$RCODE resp: $(printf '%s' "$RBODY" | head -c 160))"
fi

summary "K4 Tracker"
