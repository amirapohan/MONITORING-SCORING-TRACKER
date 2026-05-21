# CI/CD Deployment Guide

Alur kerja otomatis: **push ke GitHub → build image Docker → self-hosted runner di PC dosen tarik & jalankan**.

```
  developer push ──► GitHub Actions (ubuntu-latest) ──► Docker Hub
                                                            │
                                                            ▼
                                            self-hosted runner di PC dosen
                                            docker compose pull && up -d
```

Workflow: `.github/workflows/deploy.yml`
Compose deploy: `kelompok4/nexus-integration/docker-compose.deploy.yml`

---

## Trigger

Workflow jalan otomatis kalau push ke branch `main` atau `integration` dan ada file berubah di salah satu folder berikut:

| Folder berubah | Service yang dibuild | Image |
| --- | --- | --- |
| `kelompok1-identity-and-sso-service/**` | svc-auth | `scientivan/nexus-svc-auth` |
| `kelompok2-project-bidding-service/**` | svc-bidding | `scientivan/nexus-svc-bidding` |
| `kelompok3-team-matching-service/**` | svc-match | `scientivan/nexus-svc-match` |
| `kelompok4/backend/**` | svc-audit | `scientivan/nexus-svc-audit` |
| `kelompok5-notification-service/**` | svc-notify | `scientivan/nexus-svc-notify` |
| `kelompok4/nexus-integration/gateway.{conf,Dockerfile}` | gateway | `scientivan/nexus-gateway` |

Service yang **tidak berubah** akan di-skip — image lama di PC dosen tetap jalan.

Build manual semua: tab **Actions** → "Build & Deploy Nexus Services" → **Run workflow** → centang `force_all`.

---

## Setup awal (sekali saja)

### 1. GitHub Secrets

`Settings → Secrets and variables → Actions → New repository secret`:

| Secret | Isi |
| --- | --- |
| `DOCKERHUB_USERNAME` | `scientivan` |
| `DOCKERHUB_TOKEN` | Personal Access Token Docker Hub (scope **Read & Write**) |

> Itu saja. Tidak butuh SSH key atau Tailscale secrets — deploy job jalan langsung di PC dosen via self-hosted runner. Secret lama (`SERVER_*`, `TS_OAUTH_*`) boleh dihapus.

### 2. Self-hosted runner di PC dosen

Buka repo GitHub → **Settings → Actions → Runners → New self-hosted runner** → pilih **Linux x64**. GitHub akan menampilkan command persis seperti ini (token-nya beda tiap kali generate, salin dari halaman GitHub):

```bash
# Di PC dosen, sebagai user map:
mkdir -p ~/actions-runner && cd ~/actions-runner
curl -o actions-runner-linux-x64.tar.gz -L https://github.com/actions/runner/releases/download/v2.XXX.X/actions-runner-linux-x64-2.XXX.X.tar.gz
tar xzf actions-runner-linux-x64.tar.gz

# Configure — PENTING: saat prompt "Enter any additional labels", ketik: nexus-deploy
./config.sh --url https://github.com/scientivan/monitoring-scoring-tracker --token <TOKEN-DARI-GITHUB>

# Jalankan sebagai service (auto-start saat reboot)
sudo ./svc.sh install map
sudo ./svc.sh start
```

Verifikasi: di GitHub `Settings → Actions → Runners`, runner-mu harus muncul status **Idle** (hijau) dengan label `nexus-deploy`.

### 3. Prasyarat di PC dosen

```bash
docker --version              # docker terpasang
docker compose version        # plugin v2 terpasang
groups map | grep docker      # user map sudah di group docker
```

Kalau group docker belum ada: `sudo usermod -aG docker map && newgrp docker`.

### 4. File `.env` di PC dosen

```bash
mkdir -p /home/map/nexus
nano /home/map/nexus/.env
```

Path persis `/home/map/nexus/.env` — workflow membaca dari path itu (lihat env `ENV_FILE` di `.github/workflows/deploy.yml`).

Isi minimum (sisanya bisa default):

```env
INTERNAL_API_KEY=<openssl rand -hex 32>
JWT_SECRET=<openssl rand -hex 32>
RABBIT_USER=guest
RABBIT_PASS=guest

AUTH_DB_USER=auth
AUTH_DB_PASS=auth
AUTH_DB_NAME=auth

BIDDING_DB_USER=bidding
BIDDING_DB_PASS=bidding
BIDDING_DB_NAME=bidding

MATCH_DB_USER=match
MATCH_DB_PASS=match
MATCH_DB_NAME=match

AUDIT_DB_USER=kel4
AUDIT_DB_PASS=kel4
AUDIT_DB_NAME=kel4

GMAIL_USER=
GMAIL_PASS=
```

### 5. Boot pertama kali

Trigger workflow manual dengan `force_all=true` (tab Actions → Run workflow). Semua image ke-pull dan container start.

**Seed database** (sekali saja — kelompok2 & 3 tidak punya migrate-on-start):

```bash
# kelompok2
docker exec -i DB-bidding psql -U bidding bidding < <(curl -s https://raw.githubusercontent.com/scientivan/monitoring-scoring-tracker/main/kelompok2-project-bidding-service/database_schema.sql)

# kelompok3
docker exec -i DB-match psql -U match match < <(curl -s https://raw.githubusercontent.com/scientivan/monitoring-scoring-tracker/main/kelompok3-team-matching-service/migrations/001_initial_schema.sql)
```

Kelompok1 (Prisma) dan Kelompok4 (Prisma) jalan migrate otomatis dari CMD container.

---

## Verifikasi

Setelah workflow sukses, di PC dosen:

```bash
cd ~/actions-runner/_work/monitoring-scoring-tracker/monitoring-scoring-tracker
docker compose --env-file /home/map/nexus/.env \
  -f kelompok4/nexus-integration/docker-compose.deploy.yml ps
# semua harus Up (healthy)

curl http://localhost/api/auth/health      # via gateway
curl http://localhost:8084/api/v1/health   # langsung ke svc-audit
```

---

## Troubleshooting

- **Job "Deploy ke PC dosen" stuck "Waiting for runner"** — runner offline. Di PC dosen: `cd ~/actions-runner && sudo ./svc.sh status` → kalau down: `sudo ./svc.sh start`.
- **Build berhasil tapi deploy gagal `$ENV_FILE belum ada`** — pastikan `/home/map/nexus/.env` ada dan terbaca user `map`.
- **Container svc-X gagal up** — `docker logs SVC-x`. Biasanya migrate gagal atau env kurang.
- **Image baru tidak ke-pull** — pastikan `docker login` sukses di runner. Workflow sudah handle ini via `docker/login-action`.
