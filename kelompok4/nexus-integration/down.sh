#!/usr/bin/env bash
# ============================================================
#  NEXUS — tear down the 3 Compose groups (reverse order).
#  Pass -v to also drop DB volumes:  ./down.sh -v
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"

VOL="${1:-}"
ENVF="--env-file ./.env"
[ -f ./.env ] || ENVF=""

docker compose $ENVF -f nexus-svc-group/docker-compose.yml   down $VOL
docker compose $ENVF -f nexus-db-group/docker-compose.yml    down $VOL
docker compose $ENVF -f nexus-infra-group/docker-compose.yml down $VOL

echo "==> groups stopped. (network nexus-shared-net kept; remove with: docker network rm nexus-shared-net)"
