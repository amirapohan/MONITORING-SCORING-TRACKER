#!/usr/bin/env bash
# ============================================================
#  NEXUS — bring up the 3 Compose groups in dependency order:
#    1. nexus-infra-group  (redis, rabbit)
#    2. nexus-db-group     (5 postgres)
#    3. nexus-svc-group    (5 services + gateway, built from source)
#  All share the external network `nexus-shared-net`.
#  Run from this folder:  ./up.sh
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"

ENVF="--env-file ./.env"
[ -f ./.env ] || ENVF=""

echo "==> ensuring shared network nexus-shared-net"
docker network inspect nexus-shared-net >/dev/null 2>&1 \
  || docker network create nexus-shared-net

echo "==> [1/3] infra-group (redis, rabbit)"
docker compose $ENVF -f nexus-infra-group/docker-compose.yml up -d

echo "==> [2/3] db-group (5 postgres)"
docker compose $ENVF -f nexus-db-group/docker-compose.yml up -d

echo "==> waiting for infra + db to report healthy ..."
for i in $(seq 1 30); do
  unhealthy=$(docker ps --filter health=starting --filter name='REDIS-main\|RABBIT-main\|DB-' -q | wc -l | tr -d ' ')
  [ "$unhealthy" = "0" ] && break
  sleep 3
done

echo "==> [3/3] svc-group (build + start 5 services + gateway)"
docker compose $ENVF -f nexus-svc-group/docker-compose.yml up -d --build

echo
echo "==> done. status:"
docker compose ls
echo "Gateway: http://localhost   |  RabbitMQ UI: http://localhost:15672"
