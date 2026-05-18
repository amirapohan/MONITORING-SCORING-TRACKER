#!/bin/sh
# ============================================
# Init script: Create databases for each service
# This runs automatically on first `docker compose up`
# ============================================
# Add new databases here as new services are created:

set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE auth_db;
EOSQL

echo "All databases created successfully!"
