#!/usr/bin/env bash
# ============================================================
#  Jalankan SEMUA per-service test berurutan + ringkasan total.
#  Prasyarat: `docker compose up -d` di ../ sudah jalan & healthy.
#  Pakai: ./run-all.sh    (atau BASE=http://localhost ./run-all.sh)
# ============================================================
HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPTS=(k1-auth-test.sh k2-bidding-test.sh k3-match-test.sh k4-tracker-test.sh k5-notify-test.sh)
TOTAL_FAIL=0

for s in "${SCRIPTS[@]}"; do
  echo
  echo "############################################################"
  echo "# $s"
  echo "############################################################"
  bash "$HERE/$s"
  rc=$?
  TOTAL_FAIL=$((TOTAL_FAIL + rc))
done

echo
echo "############################################################"
echo "# TOTAL KEGAGALAN TAK TERDUGA (semua kelompok): $TOTAL_FAIL"
[ "$TOTAL_FAIL" -eq 0 ] && echo "# STATUS: ✅ OK" || echo "# STATUS: ❌ ADA YANG GAGAL"
echo "############################################################"
exit "$TOTAL_FAIL"
