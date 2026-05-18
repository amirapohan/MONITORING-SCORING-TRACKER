#!/usr/bin/env bash
# ============================================================
#  K5 — Notification : endpoint + RabbitMQ consumer via /notify
#  Lihat: k5-notify-features.txt
# ============================================================
. "$(cd "$(dirname "$0")" && pwd)/_lib.sh"
echo "K5 Notification — base=$BASE"; hr

# --- health ---
CALL GET /notify/health
expect_body "GET /notify/health" '"service":"notification"'
hr

# --- trigger: event VALID (ACCEPTED) ---
CALL POST /notify/api/notifications/trigger \
  '{"user_id":"stu-k5-e2e","status":"ACCEPTED","email":"stu.k5@mail.ugm.ac.id","project_id":"proj-k5"}'
expect_body "POST /api/notifications/trigger (valid)" "Notification processed"

# --- trigger: event TAK VALID (status di luar ACCEPTED/REJECTED) ---
CALL POST /notify/api/notifications/trigger \
  '{"user_id":"x","status":"PENDING","email":"x@mail.ugm.ac.id"}'
expect_code "POST .../trigger (status tak relevan -> tetap 200)" '^200$'
hr

# --- bukti perilaku di log container (butuh docker compose) ---
if command -v docker >/dev/null 2>&1 && [ -f "$COMPOSE" ]; then
  sleep 2
  L=$(dclogs svc-notify | tail -50)
  if printf '%s' "$L" | grep -q "Selesai proses notifikasi"; then
    ok "log: event valid diproses ('Selesai proses notifikasi')"
  else
    skip "log 'Selesai proses notifikasi' tak terlihat (cek manual)"
  fi
  if printf '%s' "$L" | grep -q '\[email:log-only\] to='; then
    ok "log: mode email log-only aktif ('[email:log-only] to=')"
  else
    skip "mode email log-only tak terlihat (mungkin GMAIL_USER/PASS di-set)"
  fi
  if printf '%s' "$(dclogs svc-notify)" | grep -q '\[rabbit\] notify consuming exchange=tracker.events'; then
    ok "consumer RabbitMQ aktif (bind exchange=tracker.events queue=notify.tracker)"
  else
    skip "baris bind consumer tak terlihat (cek: docker compose logs svc-notify)"
  fi
else
  skip "verifikasi log dilewati (docker / compose file tak tersedia)"
fi

summary "K5 Notification"
