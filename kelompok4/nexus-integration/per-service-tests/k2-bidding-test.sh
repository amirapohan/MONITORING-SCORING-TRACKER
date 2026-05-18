#!/usr/bin/env bash
# ============================================================
#  K2 — Project Bidding : uji SEMUA endpoint lewat gateway /bidding
#  Lihat: k2-bidding-features.txt
# ============================================================
. "$(cd "$(dirname "$0")" && pwd)/_lib.sh"
echo "K2 Project Bidding — base=$BASE"; hr

# --- root / liveness ---
CALL GET /bidding/;        expect_body "GET /bidding/ (liveness)"      "layanan bidding"

# --- stub GET project (echo, tanpa DB) ---
CALL GET /bidding/api/projects/42
expect_body "GET /api/projects/:id (stub echo)" "this is 42 project"

# --- stub GET bid (echo, tanpa DB) ---
CALL GET /bidding/api/bidding/7
expect_body "GET /api/bidding/:id (stub echo)" "ini adalah bidding 7"
hr

# --- POST create bid : butuh data referensi di DB (tidak di-seed) ---
GID="GK2-$(date +%s)"
CALL POST /bidding/api/bidding/ \
  "{\"group_id\":\"$GID\",\"project_id\":1,\"priority\":1,\"document_url\":\"https://x.dev/doc.pdf\",\"student_id\":\"M1\"}"
if printf '%s' "$RBODY" | grep -q "Bid created successfully"; then
  ok "POST /api/bidding/ (DB ter-seed, bid dibuat)"
elif printf '%s' "$RBODY" | grep -qE '"code":"(PROJECT_NOT_FOUND|GROUP_NOT_FOUND|STUDENT_NOT_FOUND|PROJECT_CLOSED|DUPLICATE_BID)"'; then
  ok "POST /api/bidding/ TERJANGKAU + validasi jalan (error terstruktur: $(printf '%s' "$RBODY" | sed -n 's/.*\("code":"[^"]*"\).*/\1/p'))"
  skip "  alur bid sukses tak diuji: DB referensi (mitra/proyek/kelompok/mahasiswa) tidak di-seed"
else
  bad "POST /api/bidding/ (code=$RCODE resp: $(printf '%s' "$RBODY" | head -c 160))"
fi

# --- validasi: field kurang -> VALIDATION_ERROR ---
CALL POST /bidding/api/bidding/ '{"group_id":"X"}'
expect_body "POST /api/bidding/ validasi field wajib" '"code":"VALIDATION_ERROR"'

summary "K2 Project Bidding"
