#!/usr/bin/env bash
# ============================================================
#  K3 — Team Matching : uji SEMUA endpoint lewat gateway /match
#  JWT divalidasi K3 ke K1 (/internal/validate-token) -> butuh K1 hidup.
#  Lihat: k3-match-features.txt
# ============================================================
. "$(cd "$(dirname "$0")" && pwd)/_lib.sh"
echo "K3 Team Matching — base=$BASE"; hr

PERIOD="2026-1"; PRODI="Ilmu Komputer"

# --- siapkan 4 persona talent di K1 (token divalidasi lintas-service) ---
k1_persona talent k3po;   PO_TOK="$PERSONA_TOKEN";   PO_UID="$PERSONA_UID"
k1_persona talent k3mem;  MEM_TOK="$PERSONA_TOKEN";   MEM_UID="$PERSONA_UID"
k1_persona talent k3mem2; MEM2_TOK="$PERSONA_TOKEN"; MEM2_UID="$PERSONA_UID"
k1_persona talent k3pool; POOL_TOK="$PERSONA_TOKEN"
if [ -n "$PO_TOK" ] && [ -n "$MEM_TOK" ] && [ -n "$MEM2_TOK" ] && [ -n "$POOL_TOK" ]; then
  ok "K1 persona siap (PO=$PO_UID MEM=$MEM_UID)"
elif [ "$PERSONA_RATELIMITED" -eq 1 ]; then
  skip "K3 dilewati: K1 login rate-limit (10/15m) terkena — jeda lalu ulangi"
  summary "K3 Team Matching"
else
  bad "Gagal menyiapkan persona via K1 (K1 mati?)"
  summary "K3 Team Matching"
fi
AUTH_PO="Authorization: Bearer $PO_TOK"
AUTH_MEM="Authorization: Bearer $MEM_TOK"
hr

# --- health & me (validasi JWT lintas-service ke K1) ---
CALL GET /match/health;  expect_body "GET /match/health" '"status":"ok"'
CALL GET /match/me "" -H "$AUTH_PO"
expect_body "GET /match/me (validasi JWT K1, talent->student)" '"role":"student"'
hr

# --- pool ---
POOL_BODY="{\"program_studi\":\"$PRODI\",\"period\":\"$PERIOD\",\"skills\":[\"python\",\"react\"],\"sdg_topics\":[4,9]}"
POOL_OK=1
CALL POST /match/pool "$POOL_BODY" -H "$AUTH_PO"
if printf '%s' "$RBODY" | grep -q '"status":"waiting"'; then
  ok "POST /match/pool (PO join)"
elif printf '%s' "$RBODY" | grep -q '"error":"internal_error"'; then
  POOL_OK=0
  kbug "POST /match/pool -> 500 : INTEGRASI K1<->K3 RUSAK"
  echo "       sebab: pool_entries.student_name NOT NULL, diisi dari payload.student_name"
  echo "       token K1 — tetapi JWT/validate K1 TIDAK membawa field nama -> NULL."
  echo "       (lihat k3-match-features.txt bagian KNOWN-BUG (d))"
else
  POOL_OK=0
  bad "POST /match/pool (code=$RCODE resp: $(printf '%s' "$RBODY" | head -c 140))"
fi
if [ "$POOL_OK" -eq 1 ]; then
  CALL POST /match/pool "$POOL_BODY" -H "$AUTH_MEM"; expect_body "POST /match/pool (MEM join)"  '"status":"waiting"'
  CALL POST /match/pool "$POOL_BODY" -H "Authorization: Bearer $MEM2_TOK"; expect_body "POST /match/pool (MEM2 join)" '"status":"waiting"'
  CALL POST /match/pool "$POOL_BODY" -H "Authorization: Bearer $POOL_TOK"; expect_body "POST /match/pool (POOL join)" '"status":"waiting"'
fi
CALL GET "/match/pool?period=$PERIOD" "" -H "$AUTH_PO"
expect_body "GET /match/pool (list+paginate)" '"totalPages"'
hr

# Endpoint-endpoint berikut BERGANTUNG pada pool entry. Bila POOL_OK=0
# semua di-SKIP dengan diagnosa, bukan FAIL beruntun yang menyesatkan.
if [ "$POOL_OK" -eq 0 ]; then
  hr
  skip "RANTAI BERGANTUNG POOL di-SKIP (POST /match/pool gagal — lihat KNOWN-BUG di atas):"
  skip "  profile/skills GET+PUT, teams POST, teams/:id, required-skills,"
  skip "  recommendations, invites, join-requests, members, pool/me withdraw"
  hr
else
  # --- profile/skills (butuh pool entry) ---
  CALL GET "/match/profile/skills?period=$PERIOD" "" -H "$AUTH_PO"
  expect_body "GET /match/profile/skills" '"skills"'
  CALL PUT /match/profile/skills "{\"skills\":[\"python\",\"go\"],\"sdg_topics\":[4],\"period\":\"$PERIOD\"}" -H "$AUTH_PO"
  expect_body "PUT /match/profile/skills" "Profil skill berhasil diperbarui"
  hr

  # --- teams ---
  CALL POST /match/teams "{\"name\":\"Tim K3 E2E\",\"period\":\"$PERIOD\"}" -H "$AUTH_PO"
  expect_body "POST /match/teams (PO buat tim)" '"status":"forming"'
  TID=$(printf '%s' "$RBODY" | sed -n 's/.*"data":{[^}]*"id":"\([^"]*\)".*/\1/p')
  if [ -z "$TID" ]; then
    bad "team id kosong -> rantai tim/invite/member di-SKIP"
    skip "  teams/:id, required-skills, recommendations/members, invites, join-requests, members"
  else
    ok "team id = $TID"
    CALL GET /match/teams "" -H "$AUTH_PO";        expect_body "GET /match/teams" '"data":\['
    CALL GET "/match/teams/$TID" "" -H "$AUTH_PO"; expect_body "GET /match/teams/:id" '"members"'
    CALL PUT "/match/teams/$TID/required-skills" '{"required_skills":["python","figma"]}' -H "$AUTH_PO"
    expect_body "PUT /match/teams/:id/required-skills" '"required_skills"'
    hr

    # --- recommendations ---
    CALL GET "/match/recommendations/teams?period=$PERIOD" "" -H "$AUTH_MEM"
    expect_body "GET /match/recommendations/teams" '"recommendations"'
    CALL GET "/match/recommendations/members?team_id=$TID" "" -H "$AUTH_PO"
    expect_body "GET /match/recommendations/members" '"recommendations"'
    hr

    # --- invites : PO undang MEM, MEM accept (alur happy path penuh) ---
    CALL POST "/match/teams/$TID/invites" "{\"invitee_student_id\":\"$MEM_UID\",\"message\":\"gabung yuk\"}" -H "$AUTH_PO"
    expect_body "POST /match/teams/:id/invites" '"status":"pending"'
    IID=$(printf '%s' "$RBODY" | sed -n 's/.*"data":{[^}]*"id":"\([^"]*\)".*/\1/p')
    CALL PUT "/match/invites/$IID/respond" '{"response":"accepted"}' -H "$AUTH_MEM"
    expect_body "PUT /match/invites/:id/respond (accept)" '"status":"accepted"'
    hr

    # --- join-requests (path variant) : MEM2 minta gabung, PO terima ---
    CALL POST "/match/teams/$TID/join-requests" '{"message":"izin gabung"}' -H "Authorization: Bearer $MEM2_TOK"
    expect_body "POST /match/teams/:id/join-requests" '"status":"pending"'
    JID=$(printf '%s' "$RBODY" | sed -n 's/.*"data":{[^}]*"id":"\([^"]*\)".*/\1/p')
    CALL PUT "/match/teams/$TID/join-requests/$JID" '{"action":"accepted"}' -H "$AUTH_PO"
    expect_code "PUT /match/teams/:id/join-requests/:req_id (accept)" '^200$'
    hr

    # --- member management ---
    CALL DELETE "/match/teams/$TID/members/$MEM2_UID" "" -H "$AUTH_PO"
    expect_body "DELETE /match/teams/:id/members/:sid (PO kick)" "Member berhasil dikeluarkan"
    CALL DELETE "/match/teams/$TID/members/me" "" -H "$AUTH_MEM"
    expect_body "DELETE /match/teams/:id/members/me (self-leave)" "Berhasil keluar dari tim"
    hr
  fi

  # --- withdraw dari pool (persona POOL yang belum masuk tim) ---
  CALL DELETE "/match/pool/me?period=$PERIOD" "" -H "Authorization: Bearer $POOL_TOK"
  expect_body "DELETE /match/pool/me (withdraw)" '"status":"withdrawn"'
  hr
fi

# --- internal check-team (x-service-key, BUKAN JWT) ---
if [ -n "${K3_SERVICE_KEY:-}" ]; then
  CALL GET "/match/internal/check-team/$MEM_UID" "" -H "x-service-key: $K3_SERVICE_KEY"
  expect_body "GET /match/internal/check-team/:student_id" '"has_team"'
else
  skip "GET /match/internal/check-team/:student_id  (set K3_SERVICE_KEY=...)"
fi
hr

# --- KNOWN-BUG : cacat nyata di kode K3 (skrip mengonfirmasi status terkini) ---
# (d) sudah dilaporkan di tahap pool bila terjadi.

# (a) getTeamListBySkill tak di-import -> 500
CALL GET "/match/teams?needs_skill=python" "" -H "$AUTH_PO"
if printf '%s' "$RBODY" | grep -q '"error":"internal_error"'; then
  kbug "GET /match/teams?needs_skill -> 500 (getTeamListBySkill tak di-import)"
else
  skip "GET /match/teams?needs_skill — tak 500 (code=$RCODE; mungkin sudah diperbaiki)"
fi

# (b) getActiveTeamByMember tak di-import -> 500
CALL DELETE /match/members/me "" -H "$AUTH_MEM"
if printf '%s' "$RBODY" | grep -q '"error":"internal_error"'; then
  kbug "DELETE /match/members/me -> 500 (getActiveTeamByMember tak di-import)"
else
  skip "DELETE /match/members/me — tak 500 (code=$RCODE resp: $(printf '%s' "$RBODY" | head -c 80))"
fi

# (c) GET /teams/:id/join-requests tak diimplementasi -> 404 "Cannot GET"
CALL GET "/match/teams/11111111-1111-1111-1111-111111111111/join-requests" "" -H "$AUTH_PO"
if printf '%s' "$RBODY" | grep -qi 'Cannot GET'; then
  kbug "GET /match/teams/:id/join-requests -> 404 (route tak diimplementasi)"
elif printf '%s' "$RCODE" | grep -q '404'; then
  kbug "GET /match/teams/:id/join-requests -> 404 (route tak diimplementasi)"
else
  skip "GET /match/teams/:id/join-requests — bukan 404 (code=$RCODE; mungkin sudah ada)"
fi

summary "K3 Team Matching"
