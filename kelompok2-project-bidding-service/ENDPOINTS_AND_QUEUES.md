# Kelompok 2 - Project Bidding Service: Endpoints & Queues

Dokumen ini merangkum endpoint, payload penting, event RabbitMQ, dan kesesuaian implementasi Kelompok 2 terhadap flow bidding lifecycle.

## Base URL

Via Nexus Gateway:

```text
http://localhost/bidding
```

Internal service container:

```text
http://svc-bidding:8080
```

Local/default service:

```text
http://localhost:8082
```

Catatan routing gateway:

```text
/bidding/* -> svc-bidding:8080/api/*
```

Jadi endpoint internal `/api/projects` dipanggil dari gateway sebagai `/bidding/projects`.

## Authentication

Endpoint mutating dan endpoint bid/negotiation memakai middleware auth.

Header utama:

```http
Authorization: Bearer <access_token_from_identity_service>
```

Fallback untuk testing lokal:

```http
X-User-ID: <user_id>
X-User-Type: talent | client | mitra | admin
```

Role dinormalisasi oleh middleware:

| Input Role | Normalized |
|---|---|
| `talent` | `talent` |
| `student` | `talent` |
| `client` | `client` |
| `mitra` | `client` |
| `admin` | `admin` |

## Health

| Method | Gateway Path | Internal Path | Deskripsi |
|---|---|---|---|
| GET | `/bidding/health` | `/health` | Health check service bidding |

## Project Endpoints

| Method | Gateway Path | Internal Path | Auth | Role | Deskripsi |
|---|---|---|---|---|---|
| GET | `/bidding/projects` | `/api/projects` | No | Public | Lihat semua project |
| GET | `/bidding/projects/:id` | `/api/projects/:id` | No | Public | Detail project |
| POST | `/bidding/projects` | `/api/projects` | Yes | `client` | Client membuat project baru |
| PUT | `/bidding/projects/:id` | `/api/projects/:id` | Yes | Owner `client` atau `admin` | Update project |
| DELETE | `/bidding/projects/:id` | `/api/projects/:id` | Yes | Owner `client` atau `admin` | Hapus project |

### POST `/bidding/projects`

Payload contoh:

```json
{
  "judul_proyek": "Website Marketplace Freelance",
  "deskripsi_proyek": "Membangun marketplace untuk pencarian project freelance.",
  "skills": ["Frontend", "Backend", "Database"],
  "requirements": "Tim mampu membuat REST API dan frontend dashboard.",
  "kuota_maksimal": 2,
  "budget_awal": 15000000,
  "tanggal_selesai": "2026-08-31"
}
```

Catatan:

- `mitra_id` tidak dipercaya dari request body.
- `mitra_id` dipaksa dari user token/header.
- Service akan auto-insert data `mitra` jika belum ada agar foreign key project valid.
- Setelah project berhasil dibuat, service publish event `project_created` ke RabbitMQ untuk Kelompok 5.

## Bidding Endpoints

| Method | Gateway Path | Internal Path | Auth | Role | Deskripsi |
|---|---|---|---|---|---|
| GET | `/bidding/bidding` | `/api/bidding` | Yes | `client`, `talent`, `admin` | Lihat bid sesuai role |
| GET | `/bidding/bidding/:id` | `/api/bidding/:id` | Yes | `client`, `talent`, `admin` | Detail bid |
| POST | `/bidding/bidding` | `/api/bidding` | Yes | `talent` | Talent submit bid dan initial offer |
| PUT | `/bidding/bidding/:id/status` | `/api/bidding/:id/status` | Yes | Owner `client` atau `admin` | Accept/reject bid |

### POST `/bidding/bidding`

Payload contoh:

```json
{
  "project_id": 1,
  "group_id": "team-uuid-or-id",
  "student_id": "student-uuid-or-id",
  "priority": 1,
  "document_url": "https://example.com/proposal.pdf",
  "tawaran_harga": 12000000,
  "tawaran_waktu": "2026-08-15"
}
```

Validasi yang dilakukan saat submit bid:

| Level | Validasi | Implementasi |
|---|---|---|
| 1 | Auth dan role | Hanya `talent` boleh submit bid |
| 2 | Required fields | `project_id`, `priority`, `document_url`, `student_id`, `tawaran_harga`, `tawaran_waktu` |
| 3 | Format priority | Positive integer |
| 4 | Project validity | Project harus ada dan tidak `Closed` |
| 5 | Reference validity | `kelompok` dan `mahasiswa` harus ada |
| 6 | Duplicate/quota | Satu kelompok tidak boleh bid project yang sama; quota dicek dalam transaction lock |

Status hasil submit:

| Kondisi | Status DB |
|---|---|
| Kuota masih tersedia | `Queued` |
| Kuota penuh | `Rejected` |

Catatan: flowchart menyebut status `Pending`, tetapi implementasi saat ini memakai `Queued` sebagai status awaiting review.

### PUT `/bidding/bidding/:id/status`

Payload:

```json
{
  "status": "Accepted"
}
```

Status yang diterima:

```text
Accepted | Rejected
```

Efek:

- Hanya owner `client` project atau `admin` boleh update.
- Jika `Accepted`, service memakai transaction lock untuk mencegah race condition quota.
- Jika accepted count memenuhi quota, project diubah menjadi `Full`.
- Publish event `bid_status_updated` untuk notification.
- Jika `Accepted`, publish event `bid_deal_confirmed` untuk tracker/notification.

## Negotiation Endpoints

| Method | Gateway Path | Internal Path | Auth | Role | Deskripsi |
|---|---|---|---|---|---|
| GET | `/bidding/negotiating` | `/api/negotiating` | Yes | Any authenticated | Lihat semua negosiasi |
| GET | `/bidding/negotiating/:bid_id` | `/api/negotiating/:bid_id` | Yes | Any authenticated | Lihat negosiasi untuk bid tertentu |
| POST | `/bidding/negotiating/:bid_id` | `/api/negotiating/:bid_id` | Yes | `client` owner atau `talent` owner bid | Buat counter offer |
| DELETE | `/bidding/negotiating` | `/api/negotiating` | Yes | Authenticated | Hapus negosiasi dengan aturan reply |
| PUT | `/bidding/negotiating/:nego_id/status` | `/api/negotiating/:nego_id/status` | Yes | Lawan pihak pembuat offer | Accept/reject offer |

### POST `/bidding/negotiating/:bid_id`

Payload:

```json
{
  "response_harga": 13000000,
  "response_waktu": "2026-08-20"
}
```

Catatan:

- `role_` tidak diterima dari body.
- Role negosiasi ditentukan otomatis dari `req.user.type`.
- `client` hanya boleh membuat negosiasi untuk project miliknya.
- `talent` hanya boleh membuat negosiasi untuk bid/kelompok miliknya.

### PUT `/bidding/negotiating/:nego_id/status`

Payload:

```json
{
  "status": "Accepted"
}
```

Status yang diterima:

```text
Accepted | Rejected
```

Efek:

- Jika `Accepted`, bid final menjadi `Accepted`, harga/waktu final disalin dari negotiation.
- Jika `Rejected`, bid menjadi `Rejected`.
- Jika `Accepted`, publish event `bid_deal_confirmed` untuk tracker/notification.
- Jika deal confirmed, notification event juga dikirim.

## Database Status

### Project Status

```text
Open | Full | Closed
```

### Bid Status

```text
Queued | Pending | Accepted | Rejected
```

Catatan implementasi:

- `Queued` dipakai untuk bid yang baru masuk dan menunggu review client.
- `Pending` ada di enum database tetapi belum dipakai aktif oleh controller/service.
- `Rejected` dipakai untuk auto reject quota penuh, reject oleh client, dan negotiation failed.
- Belum ada status eksplisit `AUTO_REJECTED` atau `DEAL_FAILED`.

### Negotiation Status

```text
Pending | Accepted | Rejected | Countered
```

Catatan implementasi:

- `Pending`, `Accepted`, dan `Rejected` dipakai.
- `Countered` ada di enum tetapi belum dipakai aktif.

## RabbitMQ

### Exchange

Kelompok 2 memakai exchange bersama:

```text
tracker.events
```

Type:

```text
topic
```

Routing key dibentuk oleh utility `src/utils/rabbitmq.js`:

```text
{RABBITMQ_ROUTING_PREFIX}.{eventType dengan underscore menjadi dot}
```

Default:

```text
RABBITMQ_ROUTING_PREFIX=bidding
```

Maka event `project_created` menjadi:

```text
bidding.project.created
```

### Events Published by Bidding Service

| Event Type | Routing Key | Trigger | Primary Consumer |
|---|---|---|---|
| `project_created` | `bidding.project.created` | Client berhasil membuat project | Kelompok 5 Notification |
| `bid_status_updated` | `bidding.bid.status.updated` | Client/admin accept/reject bid | Kelompok 5 Notification |
| `bid_deal_confirmed` | `bidding.bid.deal.confirmed` | Bid accepted langsung atau negotiation accepted | Kelompok 4 Tracker, Kelompok 5 Notification |
| `bid_counter_offered` | `bidding.bid.counter.offered` | Counter offer notification utility dipanggil | Kelompok 5 Notification |

### Project Created Event Payload

```json
{
  "eventType": "project_created",
  "source": "svc-bidding",
  "publishedAt": "2026-05-21T10:00:00.000Z",
  "project_id": 1,
  "project_title": "Website Marketplace Freelance",
  "client_id": "client-uuid",
  "client_name": "Client Name",
  "email": "client@example.com",
  "status": "CREATED",
  "notification_type": "PROJECT_CREATED"
}
```

### Bid Status Updated Event Payload

```json
{
  "eventType": "bid_status_updated",
  "source": "svc-bidding",
  "publishedAt": "2026-05-21T10:00:00.000Z",
  "user_id": "team-uuid-or-id",
  "status": "Accepted",
  "project_title": "Website Marketplace Freelance",
  "notification_type": "BID_STATUS_UPDATE"
}
```

### Deal Confirmed Event Payload

```json
{
  "eventType": "bid_deal_confirmed",
  "source": "svc-bidding",
  "publishedAt": "2026-05-21T10:00:00.000Z",
  "deal_id": "DEAL-1-team-uuid-or-id",
  "project_id": 1,
  "project_title": "Website Marketplace Freelance",
  "mitra_id": "client-uuid",
  "group_id": "team-uuid-or-id",
  "bid_amount": "12000000.00",
  "deal_amount": "12000000.00",
  "status": "Accepted",
  "timeline": {
    "bid_created_at": "2026-05-21T09:00:00.000Z",
    "bid_accepted_at": "2026-05-21T10:00:00.000Z",
    "estimated_completion": "2026-08-15"
  }
}
```

### Required Environment Variables

```env
RABBITMQ_URL=amqp://guest:guest@rabbit-main:5672
RABBITMQ_EXCHANGE=tracker.events
RABBITMQ_EXCHANGE_TYPE=topic
RABBITMQ_ROUTING_PREFIX=bidding
AUTH_INTERNAL_URL=http://svc-auth:8080
INTERNAL_API_KEY=nexus-internal-api-key
```

## Flowchart Compliance Review

### LANE 1: Inisiasi

Flowchart:

- User has account?
- Login or signup/fill profile.

Implementation status:

- Not owned by Kelompok 2.
- Handled by Kelompok 1 Identity & SSO.
- Kelompok 2 consumes the result via Bearer token validation to Identity internal API.

Verdict:

```text
Mostly aligned, but outside Bidding Service scope.
```

### LANE 2: Mitra / Client

Flowchart:

- Client posts project.
- Posting project triggers match alert notification to relevant talents.

Implementation status:

- `POST /bidding/projects` exists.
- Project owner is taken from auth identity, not trusted from body.
- Project creation now publishes `project_created` event to RabbitMQ.
- Notification service receives `bidding.#` events.

Gap:

- "Relevant talents" matching is not calculated in Bidding Service.
- Current event is a project-created notification event, not a targeted match alert based on talent profile.
- To fully satisfy the flowchart, this event should either be consumed by Team Matching or include target talent IDs from a matching query.

Verdict:

```text
Partially aligned.
```

### LANE 3: Talent

Flowchart:

- Talent searches projects or receives match alert.
- Rejection scenarios return talent to search.

Implementation status:

- Talent can search/browse via `GET /bidding/projects`.
- Match alert receiving is not implemented inside Bidding Service.
- Rejection states are stored as `Rejected`; client UI can show them and let talent search again.

Gap:

- No explicit endpoint/event that returns talent to search.
- No targeted match alert payload yet.

Verdict:

```text
Partially aligned.
```

### LANE 4: Interaksi

Flowchart:

- Talent submits bid and initial offer.
- System runs 6-level validation.
- Quota full auto rejects.
- Otherwise bid becomes Pending.
- Negotiation loop can occur.

Implementation status:

- `POST /bidding/bidding` supports initial offer via `tawaran_harga` and `tawaran_waktu`.
- Multiple validations exist: auth role, required fields, priority, project status, group/student references, duplicate bid, and quota.
- Quota check uses transaction lock to reduce race condition.
- Negotiation endpoints exist.

Gap:

- Flowchart says status becomes `Pending`, but implementation sets new valid bid to `Queued`.
- Auto reject is stored as `Rejected`, not a distinct `AUTO_REJECTED`.
- The "6-level validation" exists in spirit but not as a named/module-separated validation pipeline.
- No profile match validation with Kelompok 3 is currently enforced.

Verdict:

```text
Mostly aligned, with naming/status gaps.
```

### LANE 5: Keputusan

Flowchart:

- Bid waits in Pending.
- Client can Reject, Negotiate, or Accept.
- Accept ends lifecycle.
- Negotiate enters loop, then Deal Yes/No.

Implementation status:

- Client/admin can accept/reject via `PUT /bidding/bidding/:id/status`.
- Negotiation can be created via `POST /bidding/negotiating/:bid_id`.
- Negotiation offer can be accepted/rejected via `PUT /bidding/negotiating/:nego_id/status`.
- Accepted direct path and accepted negotiation path both publish deal event.

Gap:

- No explicit `NEGOTIATE` bid status or decision endpoint.
- Negotiation starts by creating negotiation records, not by setting a bid decision to `NEGOTIATE`.
- Deal failed is represented as `Rejected`, not `DEAL_FAILED`.

Verdict:

```text
Mostly aligned for accept/reject/deal, partially aligned for explicit negotiate decision.
```

## Overall Assessment

The Bidding Service already supports the core lifecycle:

```text
Client creates project -> Talent browses project -> Talent submits bid -> Quota validation -> Client accepts/rejects -> Optional negotiation -> Deal accepted/rejected -> Events published
```

However, it is not fully identical to the flowchart yet.

Items that are already working or represented:

- Project posting by client.
- Project-created event for notification.
- Talent project browsing.
- Bid submission with initial offer.
- Validation and quota check.
- Auto reject when quota is full.
- Client accept/reject.
- Negotiation loop through negotiation endpoints.
- Deal accepted path.
- RabbitMQ events for notification/tracker.

Items that still need improvement for exact flowchart compliance:

- Add targeted match-alert logic or integrate `project_created` event with Team Matching to identify relevant talents.
- Decide whether to rename `Queued` to `Pending`, or document `Queued` as the Pending-equivalent state.
- Add explicit status/event for `AUTO_REJECTED` if the flowchart needs separate reporting.
- Add explicit status/event for `DEAL_FAILED` if negotiation failure should be distinguished from normal `Rejected`.
- Add explicit `NEGOTIATE` decision/status if Mitra's three-way decision must be modeled directly.
- Add profile-match/eligibility validation against Kelompok 3 if "6-level validation" must include matching quality.

