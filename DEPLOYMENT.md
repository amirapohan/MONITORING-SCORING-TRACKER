# CI/CD Deployment Guide

Alur kerja otomatis: **push ke GitHub → build image Docker → deploy container di PC dosen**.

```
  developer push ──► GitHub Actions ──► Docker Hub ──► (SSH/Tailscale) ──► PC dosen
                     (build + push)                                       docker compose pull && up -d
```

Workflow: `.github/workflows/deploy.yml`
Compose deploy: `kelompok4/nexus-integration/docker-compose.deploy.yml`

---

## Trigger

Workflow jalan otomatis kalau push ke branch `main` atau `integration` dan ada file berubah di salah satu folder berikut:

| Folder berubah                                          | Service yang dibuild | Image                          |
| ------------------------------------------------------- | -------------------- | ------------------------------ |
| `kelompok1-identity-and-sso-service/**`                 | svc-auth             | `scientivan/nexus-svc-auth`    |
| `kelompok2-project-bidding-service/**`                  | svc-bidding          | `scientivan/nexus-svc-bidding` |
| `kelompok3-team-matching-service/**`                    | svc-match            | `scientivan/nexus-svc-match`   |
| `kelompok4/backend/**`                                  | svc-audit            | `scientivan/nexus-svc-audit`   |
| `kelompok5-notification-service/**`                     | svc-notify           | `scientivan/nexus-svc-notify`  |
| `kelompok4/nexus-integration/gateway.{conf,Dockerfile}` | gateway              | `scientivan/nexus-gateway`     |

Service yang **tidak berubah** akan di-skip — image lama di PC dosen tetap jalan.

Mau build ulang semua manual? Buka tab **Actions** di GitHub → "Build & Deploy Nexus Services" → **Run workflow** → centang `force_all`.

---

## Setup awal (sekali saja)

### 1. GitHub Secrets

`Settings → Secrets and variables → Actions → New repository secret`:

| Secret               | Isi                                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `TS_OAUTH_CLIENT_ID` | OAuth client ID dari Tailscale (opsional — kalau PC dosen tidak punya IP publik)                                      |
| `SERVER_SSH_KEY`     | Private key SSH (isi penuh, termasuk header `-----BEGIN ...`) yang public key-nya sudah di-`authorized_keys` PC dosen |

|
| `SERVER_HOST` | Hostname/IP PC dosen (mis. Tailscale MagicDNS: `pc-dosen.tailxxxx.ts.net`) |
| `DOCKERHUB_TOKEN` | Personal Access Token Docker Hub (scope **Read & Write**) |
| `SERVER_USER` | Username SSH di PC dosen (mis. `aidiel`) |
`DOCKERHUB_USERNAME` | `scientivan` |
| `TS_OAUTH_SECRET` | OAuth secret dari Tailscale |

> **Tailscale tidak dipakai?** Hapus step `Connect to Tailnet` di `.github/workflows/deploy.yml` kalau PC dosen sudah bisa diakses SSH langsung.

### 2. PC dosen (sekali saja)

Pasang prasyarat:

```bash
# Docker + compose plugin (Ubuntu)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER     # logout/login lagi

# Tailscale (kalau pakai)
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Buat folder deploy + `.env`:

```bash
mkdir -p ~/nexus && cd ~/nexus
# Salin .env.example dari repo, isi nilainya
curl -O https://raw.githubusercontent.com/scientivan/monitoring-scoring-tracker/main/kelompok4/nexus-integration/.env.deploy.example
mv .env.deploy.example .env
nano .env
```

Tambah public key milik GitHub runner ke `~/.ssh/authorized_keys` (private key-nya disimpan sebagai `SERVER_SSH_KEY` di GitHub Secrets).

### 3. Boot pertama kali

Trigger sekali workflow dengan `force_all=true` (dari tab Actions GitHub). Setelah image semua nongol di Docker Hub dan compose file ter-scp ke `~/nexus/`, semua container akan up.

**Seed database** (sekali saja — kelompok2 & 3 tidak punya migrate-on-start):

```bash
cd ~/nexus
# kelompok2
curl -O https://raw.githubusercontent.com/scientivan/monitoring-scoring-tracker/main/kelompok2-project-bidding-service/database_schema.sql
docker exec -i DB-bidding psql -U bidding bidding < database_schema.sql

# kelompok3
curl -O https://raw.githubusercontent.com/scientivan/monitoring-scoring-tracker/main/kelompok3-team-matching-service/migrations/001_initial_schema.sql
docker exec -i DB-match psql -U match match < 001_initial_schema.sql
```

Kelompok1 (Prisma) dan Kelompok4 (Prisma) jalan migrate otomatis dari CMD container.

---

## Verifikasi

Setelah workflow sukses, di PC dosen:

```bash
cd ~/nexus
docker compose -f docker-compose.deploy.yml ps
# semua harus Up (healthy)

curl http://localhost/api/auth/health      # via gateway
curl http://localhost:8084/api/v1/health   # langsung ke svc-audit
```

Atau buka di browser PC dosen: `http://localhost`.

---

## Troubleshooting

- **Workflow gagal di step `Connect to Tailnet`** — verifikasi OAuth client di Tailscale punya scope `auth_keys` + tag `tag:ci` di ACL.
- **Workflow gagal di step SSH** — uji manual: `ssh -i <private-key> $SERVER_USER@$SERVER_HOST`. Pastikan public key sudah di `authorized_keys`.
- **Image baru ter-push tapi container tidak update** — cek `docker compose -f docker-compose.deploy.yml pull` di PC dosen. Pastikan `:latest` tag yang ditarik.
- **Build gagal — Dockerfile tidak ketemu** — perhatikan kelompok4 pakai `dockerfile` (huruf kecil semua), bukan `Dockerfile`. Matrix di workflow sudah handle ini.
