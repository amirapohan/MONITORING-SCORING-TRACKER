#!/bin/sh
set -e

# Nexus compose passes individual vars (DATABASE_HOST, DATABASE_USER, ...) instead of DATABASE_URL.
# Construct DATABASE_URL from parts when it is not explicitly provided.
if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@${DATABASE_HOST}:${DATABASE_PORT:-5432}/${DATABASE_NAME}"
  echo "[entrypoint] Constructed DATABASE_URL (host: ${DATABASE_HOST})"
fi

echo "[entrypoint] Syncing database schema (prisma db push)..."
MAX_RETRIES=15
ATTEMPT=0
until npx prisma db push --skip-generate --accept-data-loss; do
  ATTEMPT=$((ATTEMPT + 1))
  if [ "$ATTEMPT" -ge "$MAX_RETRIES" ]; then
    echo "[entrypoint] Database not reachable after $MAX_RETRIES attempts. Exiting."
    exit 1
  fi
  echo "[entrypoint] Database not ready, retrying in 3s... ($ATTEMPT/$MAX_RETRIES)"
  sleep 3
done

echo "[entrypoint] Schema ready. Starting application..."
exec node src/index.js
