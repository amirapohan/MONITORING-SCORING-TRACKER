# NEXUS — Integrasi & Demo 5 Microservices

Repo orchestrator untuk menjalankan semua microservice tugas Arsitektur Perangkat Lunak
secara bersamaan, lengkap dengan API Gateway dan message broker (RabbitMQ).

## Arsitektur

```
                                  ┌──────────────────────────────┐
  Client / Penguji ──HTTP──▶  API Gateway (nginx :80)            │
                                  │  /auth /bidding /match         │
                                  │  /tracker /notify              │
                                  └───┬───┬───┬───┬───┬───────────┘
                                      │   │   │   │   │
                 ┌────────────────────┘   │   │   │   └───────────────┐
                 ▼          ▼              ▼   ▼                       ▼
              svc-auth  svc-bidding   svc-match svc-audit          svc-notify
                 │          │              │      │                    ▲
              db-auth   db-bidding     db-match db-audit            db-notify
                 │          │              │      │
                 └──── event (publish) ────┴──────┴──▶ [ RabbitMQ ] ──┘
                                                        (async, mis. notifikasi)
```

- **Sinkron** (butuh jawaban langsung): lewat **Gateway** → service → DB-nya sendiri.
- **Asinkron** (notifikasi, audit, event): service **publish ke RabbitMQ**,
  `svc-notify` meng-*consume* tanpa pemanggil harus menunggu.
- **Database per service** (tidak ada DB bersama) — pola microservice yang benar.

## Pemetaan service

| Service     | Repo                                          | Gateway path | Port host | DB host port |
|-------------|-----------------------------------------------|--------------|-----------|--------------|
| svc-auth    | fahmiirfanfaiz/identity-and-sso-service        | `/auth/`     | 8081      | 5431         |
| svc-bidding | agaggigit/microservice-project-bidding         | `/bidding/`  | 8082      | 5432         |
| svc-match   | rapp407/team-matching-service                  | `/match/`    | 8083      | 5433         |
| svc-audit   | scientivan/monitoring-scoring-tracker          | `/tracker/`  | 8084      | 5434         |
| svc-notify  | danellazs/apl-notification                     | `/notify/`   | 8085      | 5435         |

Infra bersama: RabbitMQ (`:5672` AMQP, `:15672` dashboard), Redis (`:6379`).

## Cara menjalankan

```bash
cp .env.example .env          # isi nilai (Supabase, image, dll)

# Opsi A — semua tim sudah push image ke Docker Hub:
docker compose up -d

# Opsi B — build dari source (clone semua repo jadi folder sebelah dulu):
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

Cek: <http://localhost> (gateway), <http://localhost:15672> (RabbitMQ, user/pass: guest).

---

# ✅ CHECKLIST DEMO INTEGRASI

## Fase 1 — Persiapan tiap tim (H-7, paralel)
Tiap tim WAJIB menyelesaikan ini di repo masing-masing:

- [ ] Punya `Dockerfile` yang bisa di-build (`docker build .` sukses).
- [ ] Container **listen di port internal 8080** (atau sepakati & sesuaikan compose).
- [ ] Tidak hardcode `localhost` untuk DB/RabbitMQ — baca dari **env var**
      (`DB_HOST`, `RABBIT_URL`, dll).
- [ ] Punya endpoint health check sederhana (mis. `GET /health` → 200).
- [ ] Build & push image: `docker build -t <user>/<svc>:latest . && docker push ...`
- [ ] Kabari `image:` final ke pemilik repo integrasi → update `.env`.

## Fase 2 — Sepakati kontrak antar tim (H-7)
- [ ] Format **auth token** disepakati (JWT? header apa?). Gateway/`svc-auth` jadi acuan.
- [ ] **Nama exchange/queue RabbitMQ** disepakati antara publisher & `svc-notify`
      (mis. exchange `events`, routing key `bid.won`, `team.matched`).
- [ ] Format payload event (JSON schema) disepakati & ditulis di README ini.
- [ ] Path API tiap service tidak bentrok dengan prefix gateway (`/auth`, `/bidding`, ...).

## Fase 3 — Smoke test integrasi (H-3)
- [ ] `docker compose up -d` → semua container **Up / healthy**
      (`docker compose ps`).
- [ ] `curl http://localhost/healthz` → `gateway ok`.
- [ ] Tiap service hidup: `curl http://localhost/auth/health`, dst.
- [ ] RabbitMQ dashboard terbuka, queue dari `svc-notify` terlihat ter-bind.
- [ ] Cek log tiap service tidak ada error koneksi DB/Rabbit:
      `docker compose logs svc-auth`.

## Fase 4 — Skenario demo end-to-end (hari-H)
Tunjukkan **alur yang melewati banyak service** (bukan tiap service sendiri-sendiri):

1. [ ] **Register/Login** via `POST http://localhost/auth/...` → dapat token.
2. [ ] Pakai token: **buat tim** via `/match/...` (auth diverifikasi).
3. [ ] **Buat/menangkan bidding** via `/bidding/...`.
4. [ ] Tunjukkan `svc-bidding` **publish event** ke RabbitMQ
       (lihat di dashboard `:15672`, message rate naik).
5. [ ] `svc-notify` **meng-consume** event → notifikasi tercatat
       (cek `GET /notify/...` atau log container).
6. [ ] `svc-audit` (tracker) menampilkan **skor/log aktivitas** dari event tsb.
7. [ ] **Skenario gagal (nilai plus):** matikan `svc-notify`
       (`docker compose stop svc-notify`), lakukan aksi, hidupkan lagi →
       tunjukkan notifikasi **tidak hilang** (masih diproses dari antrian).
       Ini bukti nyata keunggulan message broker.

## Fase 5 — Cadangan saat demo gagal
- [ ] Siapkan `docker compose logs -f` di terminal terpisah.
- [ ] Kalau 1 service rusak: tunjukkan service lain tetap jalan
      (bukti **loose coupling** — justru poin arsitektur).
- [ ] Punya screenshot/rekaman alur sukses sebagai cadangan.

## Catatan keamanan (kerjakan sekarang)
- [ ] **Rotate** `SUPABASE_SERVICE_ROLE_KEY` lama yang sempat ter-commit.
- [ ] `.env` masuk `.gitignore` di semua repo; bagikan hanya `.env.example`.
