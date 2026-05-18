#!/usr/bin/env bash
# ============================================================
#  K1 — Identity & SSO  : uji SEMUA endpoint lewat gateway /auth
#  Lihat: k1-auth-features.txt
# ============================================================
. "$(cd "$(dirname "$0")" && pwd)/_lib.sh"
echo "K1 Identity & SSO — base=$BASE"; hr

# --- health & root ---
CALL GET /auth/health;   expect_body "GET /auth/health"            '"status":"ok"'
CALL GET /auth/api/;     expect_body "GET /auth/api/ (welcome)"    "Welcome to identity-and-sso-service API"
hr

# --- register + login (talent) ---
EMAIL="k1_$(date +%s)_$RANDOM@nexus.dev"; PW="Passw0rd!23"
CALL POST /auth/api/auth/register "{\"name\":\"K1 Talent\",\"email\":\"$EMAIL\",\"password\":\"$PW\",\"role\":\"talent\"}"
expect_body "POST /api/auth/register (talent)" "User registered successfully"

CALL POST /auth/api/auth/login "{\"email\":\"$EMAIL\",\"password\":\"$PW\"}"
expect_body "POST /api/auth/login" '"accessToken"'
TOKEN=$(printf '%s' "$RBODY" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
REFRESH=$(printf '%s' "$RBODY" | sed -n 's/.*"refreshToken":"\([^"]*\)".*/\1/p')
USERID=$(printf '%s' "$RBODY" | sed -n 's/.*"user":{[^}]*"id":"\([^"]*\)".*/\1/p')
[ -n "$TOKEN" ] && ok "JWT diterima (len=${#TOKEN}) user=$USERID" || bad "JWT kosong"
hr

# --- refresh ---
CALL POST /auth/api/auth/refresh "{\"refreshToken\":\"$REFRESH\"}"
expect_body "POST /api/auth/refresh" "Access token refreshed"

# --- profile GET / PUT (butuh Bearer) ---
CALL GET /auth/api/auth/profile "" -H "Authorization: Bearer $TOKEN"
expect_body "GET /api/auth/profile" "Profile retrieved successfully"
CALL PUT /auth/api/auth/profile "{\"name\":\"K1 Talent Updated\"}" -H "Authorization: Bearer $TOKEN"
expect_body "PUT /api/auth/profile" "Profile updated successfully"

# --- google login (tanpa idToken valid -> harus tetap endpoint terjangkau) ---
CALL POST /auth/api/auth/google "{\"idToken\":\"dummy.invalid.token\"}"
expect_code "POST /api/auth/google (reachable, tolak token palsu)" '^(400|401|500)$'
hr

# --- internal API (butuh x-internal-api-key) ---
IKEY="${INTERNAL_API_KEY:-change-this-internal-api-key}"
CALL POST /auth/internal/validate-token "{\"token\":\"$TOKEN\"}" -H "x-internal-api-key: $IKEY"
if printf '%s' "$RBODY" | grep -q "Token is valid"; then
  ok "POST /internal/validate-token"
  CALL GET "/auth/internal/users/$USERID" "" -H "x-internal-api-key: $IKEY"
  expect_body "GET /internal/users/:id" "User found"
  CALL GET /auth/internal/users "" -H "x-internal-api-key: $IKEY"
  expect_body "GET /internal/users" "Users retrieved"
  CALL GET /auth/internal/audit-logs "" -H "x-internal-api-key: $IKEY"
  expect_body "GET /internal/audit-logs" "Audit logs retrieved"
  CALL GET "/auth/internal/talents/$USERID/project-completions" "" -H "x-internal-api-key: $IKEY"
  expect_body "GET /internal/talents/:id/project-completions" "Project completions retrieved"
  CALL POST /auth/internal/project-completions \
    "{\"talent_id\":\"$USERID\",\"project_id\":\"proj-k1-test\",\"token_id\":\"tok-k1\",\"ipfs_uri\":\"ipfs://Qmtest\",\"completion_date\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"}" \
    -H "x-internal-api-key: $IKEY"
  expect_code "POST /internal/project-completions" '^(201|409)$'
else
  skip "internal API /auth/internal/* — key salah/tak dikonfigurasi (set INTERNAL_API_KEY=...)"
  skip "  -> validate-token, users, users/:id, audit-logs, project-completions, talents/:id/completions"
fi
hr

# --- admin-only (butuh akun admin; tak bisa dibuat via register publik) ---
if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  CALL POST /auth/api/auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
  ATOK=$(printf '%s' "$RBODY" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
  AEMAIL="k1adm_$(date +%s)@nexus.dev"
  CALL POST /auth/api/auth/register/admin \
    "{\"name\":\"K1 Mid\",\"email\":\"$AEMAIL\",\"password\":\"Passw0rd!23\",\"role\":\"talent\"}" \
    -H "Authorization: Bearer $ATOK"
  expect_body "POST /api/auth/register/admin" "User registered successfully"
  NID=$(printf '%s' "$RBODY" | sed -n 's/.*"user":{[^}]*"id":"\([^"]*\)".*/\1/p')
  CALL PATCH "/auth/api/auth/users/$NID/deactivate" "" -H "Authorization: Bearer $ATOK"
  expect_body "PATCH /api/auth/users/:id/deactivate" "User deactivated successfully"
else
  skip "POST /api/auth/register/admin  (set ADMIN_EMAIL & ADMIN_PASSWORD)"
  skip "PATCH /api/auth/users/:id/deactivate  (butuh akun admin)"
fi
hr

# --- logout (terakhir: mencabut token) ---
CALL POST /auth/api/auth/logout "{\"refreshToken\":\"$REFRESH\"}" -H "Authorization: Bearer $TOKEN"
expect_body "POST /api/auth/logout" "Logged out successfully"

summary "K1 Identity & SSO"
