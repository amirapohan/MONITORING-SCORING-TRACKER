#!/usr/bin/env bash
# Simple smoke test for projects endpoints (local and remote)
set -euo pipefail

REMOTE_URL=${1:-"http://map-sandbox.tailcbdd04.ts.net/bidding"}
LOCAL_URL=${2:-"http://localhost:3000"}

echo "Testing local GET ${LOCAL_URL}/api/projects"
curl -s -o /dev/null -w "LOCAL GET: %{http_code}\n" ${LOCAL_URL}/api/projects

echo "Testing local POST ${LOCAL_URL}/api/projects"
curl -s -o /dev/null -w "LOCAL POST: %{http_code}\n" -X POST ${LOCAL_URL}/api/projects \
  -H "Content-Type: application/json" \
  -H "X-User-ID: 123" -H "X-User-Type: client" \
  -d '{"judul_proyek":"smoke","deskripsi_proyek":"smoke","skills":["Backend"],"requirements":"req","kuota_maksimal":1,"budget_awal":100}' || true

echo "Testing remote GET ${REMOTE_URL}/projects"
curl -s -o /dev/null -w "REMOTE GET: %{http_code}\n" ${REMOTE_URL}/projects || true

echo "Testing remote POST ${REMOTE_URL}/projects"
curl -s -o /dev/null -w "REMOTE POST: %{http_code}\n" -X POST ${REMOTE_URL}/projects \
  -H "Content-Type: application/json" \
  -H "X-User-ID: 123" -H "X-User-Type: client" \
  -d '{"judul_proyek":"smoke-remote","deskripsi_proyek":"smoke","skills":["Backend"],"requirements":"req","kuota_maksimal":1,"budget_awal":100}' || true

exit 0
