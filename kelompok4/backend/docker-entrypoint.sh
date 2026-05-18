#!/bin/sh
set -e

# Sinkronkan skema Prisma ke PostgreSQL secara otomatis saat container start.
# `prisma db push` membuat/menyesuaikan tabel sesuai schema.prisma (idempotent).
echo "[entrypoint] Menyiapkan skema database (prisma db push)..."
npx prisma db push --skip-generate --accept-data-loss

echo "[entrypoint] Skema siap. Menjalankan aplikasi..."
exec node server.js
