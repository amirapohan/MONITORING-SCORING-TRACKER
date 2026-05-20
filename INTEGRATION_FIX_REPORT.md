# Integration Fix Report

Tanggal: 2026-05-20

## Tujuan

Merapikan kontrak integrasi antar microservice di `repo-dien` agar 5 service utama dapat dijalankan melalui orchestrator `kelompok4/nexus-integration` dengan pola komunikasi yang lebih konsisten:

- HTTP sinkron melalui API Gateway.
- Auth terpusat melalui Identity & SSO.
- Event asinkron melalui RabbitMQ.
- Health check yang seragam untuk Docker Compose.

## Perubahan Utama

### 1. Project Bidding Service

Folder: `kelompok2-project-bidding-service`

Perubahan:

- Menambahkan endpoint health check:
  - `GET /health`
- Mengaktifkan auth middleware pada:
  - `POST /api/bidding`
- Memperbarui auth middleware agar mendukung dua mode:
  - Bearer token JWT yang divalidasi ke Identity & SSO melalui `POST /internal/validate-token`.
  - Header lama `X-User-ID` dan `X-User-Type` untuk kompatibilitas lokal.
- Memetakan role SSO:
  - `talent` atau `student` menjadi `talent`.
  - `client` atau `mitra` menjadi `mitra`.
- Memperbaiki pembuatan bid agar sesuai dengan schema database:
  - Request sekarang memvalidasi `tawaran_harga`.
  - Request sekarang memvalidasi `tawaran_waktu`.
  - Insert ke tabel `bid` sekarang mengisi `tawaran_harga` dan `tawaran_waktu`.
- Memperbaiki perbandingan ownership pada negotiation agar tidak gagal karena beda tipe data string/integer.
- Mengembalikan field `status` pada query negotiation agar logic `updateNegotiationStatus` dapat mengecek status pending dengan benar.
- Mengganti publish RabbitMQ dari queue langsung menjadi topic exchange:
  - Exchange default: `tracker.events`
  - Routing prefix default: `bidding`
  - Contoh routing key: `bidding.bid.deal.confirmed`

File yang diubah:

- `src/app.js`
- `src/middleware/auth.middleware.js`
- `src/utils/rabbitmq.js`
- `src/utils/notification.js`
- `src/utils/tracker.js`
- `src/features/bidding/routes/bidding.routes.js`
- `src/features/bidding/controllers/bidding.controller.js`
- `src/features/bidding/services/bidding.service.js`
- `src/features/negotiating/controllers/negotiating.controller.js`
- `src/features/negotiating/services/negotiating.service.js`

### 2. Notification Service

Folder: `kelompok5-notification-service`

Perubahan:

- RabbitMQ consumer sekarang dapat bind ke lebih dari satu routing key.
- Default binding menjadi:
  - `tracker.#`
  - `bidding.#`
- Queue default integrasi menjadi `notify.events`.
- Consumer dapat menerima event dari tracker maupun bidding.
- Manual notification handler sekarang:
  - Menormalisasi `recipient_id` menjadi `user_id`.
  - Menormalisasi `deal_id` menjadi `project_id`.
  - Menyimpan log walaupun event tidak punya email.
  - Tidak memaksa kirim email jika payload hanya cukup untuk audit/log.

File yang diubah:

- `src/services/trackerConsumer.js`
- `src/services/notificationService.js`

### 3. Nexus Integration Orchestrator

Folder: `kelompok4/nexus-integration`

Perubahan pada `docker-compose.yml`:

- `svc-bidding` sekarang menerima env integrasi:
  - `AUTH_INTERNAL_URL=http://svc-auth:8080`
  - `INTERNAL_API_KEY`
  - `RABBITMQ_URL`
  - `RABBITMQ_EXCHANGE=tracker.events`
  - `RABBITMQ_EXCHANGE_TYPE=topic`
  - `RABBITMQ_ROUTING_PREFIX=bidding`
- `svc-bidding` sekarang menunggu `rabbit-main` healthy.
- Health check `svc-bidding` diarahkan ke `GET /health`.
- `svc-notify` sekarang menerima env RabbitMQ:
  - `RABBITMQ_EXCHANGE=tracker.events`
  - `RABBITMQ_EXCHANGE_TYPE=topic`
  - `RABBITMQ_QUEUE=notify.events`
  - `RABBITMQ_BINDINGS=tracker.#,bidding.#`

Perubahan pada `gateway.conf`:

- Gateway sekarang menerjemahkan prefix publik ke path internal service:
  - `GET /auth/health` -> `GET /health`
  - `/auth/*` -> `/api/auth/*`
  - `GET /bidding/health` -> `GET /health`
  - `/bidding/*` -> `/api/*`
  - `/match/*` tetap langsung ke service matching.
  - `GET /tracker/health` -> `/api/v1/health`
  - `/tracker/*` -> `/api/v1/*`
  - `GET /notify/health` -> `/health`
  - `/notify/*` -> `/api/*`

## Kontrak Gateway Setelah Perbaikan

Endpoint gateway yang disarankan:

- `GET http://localhost/healthz`
- `GET http://localhost/auth/health`
- `POST http://localhost/auth/register`
- `POST http://localhost/auth/login`
- `GET http://localhost/bidding/health`
- `POST http://localhost/bidding/bidding`
- `GET http://localhost/match/health`
- `GET http://localhost/tracker/health`
- `GET http://localhost/notify/health`
- `POST http://localhost/notify/notifications/trigger`

## Kontrak Event RabbitMQ

Exchange bersama:

- `tracker.events`

Routing key yang dipakai:

- Tracker service publish dengan prefix:
  - `tracker.*`
- Bidding service publish dengan prefix:
  - `bidding.*`
- Notification service consume:
  - `tracker.#`
  - `bidding.#`

Dengan ini, bidding dan tracker dapat mengirim event ke exchange yang sama, dan notification dapat menerima event dari keduanya.

## Verifikasi yang Sudah Dilakukan

Verifikasi berhasil:

- `node --check` untuk file JS yang diubah di bidding service.
- `node --check` untuk file JS yang diubah di notification service.
- `docker compose config --quiet` pada `kelompok4/nexus-integration`.

Catatan:

- `docker compose config` mengeluarkan warning karena `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` belum diisi. Compose tetap valid.
- Ada warning akses `C:\Users\ASUS\.docker\config.json` saat menjalankan Docker dari sandbox, tetapi `docker compose config` tetap berhasil.

Verifikasi runtime penuh belum bisa dilakukan karena Docker daemon tidak aktif/terhubung di mesin ini:

```text
open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
```

## Langkah Uji Runtime yang Disarankan

Jalankan dari folder:

```bash
cd repo-dien/kelompok4/nexus-integration
docker compose up -d --build
```

Lalu cek:

```bash
docker compose ps
curl http://localhost/healthz
curl http://localhost/auth/health
curl http://localhost/bidding/health
curl http://localhost/match/health
curl http://localhost/tracker/health
curl http://localhost/notify/health
```

Untuk alur minimal:

1. Register/login via `/auth/register` dan `/auth/login`.
2. Gunakan access token sebagai `Authorization: Bearer <token>`.
3. Buat bid via `/bidding/bidding` dengan payload yang menyertakan `tawaran_harga` dan `tawaran_waktu`.
4. Pantau RabbitMQ dashboard di `http://localhost:15672`.
5. Cek log `svc-notify` untuk memastikan event `bidding.#` diterima.

