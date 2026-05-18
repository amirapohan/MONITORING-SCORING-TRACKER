# Inter-Service Integration Guide
# Identity & SSO Service

> Dokumen ini ditujukan untuk tim yang mengembangkan service lain
> (bidding-service, notification-service, dll.) agar bisa berintegrasi
> dengan identity-and-sso-service.

---

## ⚠️ Status Saat Ini: MOCK MODE

Auth-service belum live. Sementara itu, **mock endpoint sudah tersedia**
dan bisa langsung dipakai di `template-service` (port 3000 via Docker).

**Mock Users yang tersedia untuk testing:**

| Email | Password | Role |
|-------|----------|------|
| `talent@mock.dev` | apa saja | `talent` |
| `client@mock.dev` | apa saja | `client` |
| `admin@mock.dev` | apa saja | `admin` |
| `exists@mock.dev` | — | Simulasi email sudah terdaftar (409) |
| apa saja | `wrong` | Simulasi password salah (401) |

Semua response mock punya field `"_mock": true` sebagai penanda.

---

## Konsep Utama

```
CLIENT
  │
  │── POST /api/auth/login ──▶ identity-and-sso-service
  │                                    │
  │◀──────── accessToken ──────────────┘
  │
  │── Request + Header: "Authorization: Bearer <accessToken>" ──▶ bidding-service
                                                                        │
                                                          Verify JWT lokal (tidak
                                                          perlu call auth-service)
                                                                        │
                                                              Handle request
```

**Prinsip**: Token JWT sudah berisi informasi user. Service lain
cukup memverifikasi token secara lokal menggunakan JWT_SECRET yang sama.
Tidak perlu memanggil identity-and-sso-service untuk setiap request.

---

## Apa yang Ada di Dalam JWT Token?

Setiap access token yang digenerate auth-service berisi payload:

```json
{
  "id": "uuid-user",
  "email": "user@example.com",
  "role": "talent",
  "iat": 1714000000,
  "exp": 1714000900
}
```

Setelah token diverifikasi, payload ini bisa diakses di `req.user`.
Role yang tersedia: `talent`, `client`, `admin`.

---

## Cara Integrasi untuk Service Lain

### Langkah 1 — Pastikan JWT_SECRET sama

Di `.env` setiap service, gunakan JWT_SECRET yang SAMA:
```
JWT_SECRET=nilai-yang-sama-dengan-auth-service
```

Di docker-compose.yml, semua service sudah menggunakan variable yang sama
dari root `.env`, jadi ini otomatis terpenuhi.

### Langkah 2 — Copy middleware authenticate

Buat file `src/middlewares/authenticate.js` di service kamu:

```js
const jwt = require('jsonwebtoken');
const config = require('../config');

const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required',
    });
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret);
    req.user = payload; // { id, email, role }
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};

module.exports = authenticate;
```

### Langkah 3 — (Opsional) Copy middleware authorize

Untuk membatasi akses berdasarkan role:

```js
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: insufficient permissions',
      });
    }
    next();
  };
};

module.exports = authorize;
```

### Langkah 4 — Pakai di route

```js
const authenticate = require('../middlewares/authenticate');
const authorize   = require('../middlewares/authorize');

// Semua user yang sudah login bisa akses
router.get('/projects', authenticate, listProjects);

// Hanya talent yang bisa submit bid
router.post('/bids', authenticate, authorize(['talent']), submitBid);

// Hanya admin
router.delete('/projects/:id', authenticate, authorize(['admin']), deleteProject);
```

---

## Public Endpoints (Bisa diakses tanpa token)

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | /api/auth/register | Daftar akun baru |
| POST | /api/auth/login | Login, dapat token |
| POST | /api/auth/refresh | Perbarui access token |

---

## Protected Endpoints (Butuh token di header)

Header yang diperlukan:
```
Authorization: Bearer <accessToken>
```

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | /api/auth/logout | Logout, invalidate refresh token |
| GET | /api/auth/profile | Lihat profil sendiri |
| PUT | /api/auth/profile | Update profil sendiri |

---

## Internal Endpoints (Untuk service-to-service)

Endpoint ini HANYA bisa dipanggil dari dalam Docker network (tidak expose ke publik).
Gunakan service name sebagai host, contoh: `http://auth-service:3000/internal/...`

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | /internal/users/:id | Ambil data user by ID |
| POST | /internal/validate-token | Validasi token (opsional, kalau tidak mau verify lokal) |

### Contoh: bidding-service butuh data user

```js
// Di bidding-service, saat butuh detail user
const axios = require('axios');

const getUserById = async (userId) => {
  const response = await axios.get(
    `http://auth-service:3000/internal/users/${userId}`
  );
  return response.data.data; // { id, name, email, role }
};
```

### Response GET /internal/users/:id

```json
{
  "success": true,
  "data": {
    "id": "uuid-user",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "talent",
    "is_active": true
  }
}
```

---

## Contoh Flow Lengkap: Submit Bid

```
1. Talent login
   POST http://localhost:3001/api/auth/login
   Body: { email, password }
   → Dapat: { accessToken, refreshToken }

2. Talent submit bid
   POST http://localhost:3003/api/bids
   Header: Authorization: Bearer <accessToken>
   Body: { projectId, amount, proposal }

3. bidding-service:
   - Middleware authenticate() verify token lokal
   - req.user = { id: "uuid", email: "...", role: "talent" }
   - Cek role talent → boleh submit bid
   - Simpan bid ke database dengan user_id = req.user.id
   - Return { success: true, data: { bid } }
```

---

## Format Response yang Konsisten (WAJIB diikuti semua service)

**Success:**
```json
{
  "success": true,
  "message": "Keterangan singkat",
  "data": { }
}
```

**Error:**
```json
{
  "success": false,
  "message": "Keterangan error",
  "errors": [ ]
}
```

---

## Port Mapping (Local Development)

| Service | Port | Contoh URL |
|---------|------|------------|
| identity-and-sso-service | 3001 | http://localhost:3001 |
| project-service (nanti) | 3002 | http://localhost:3002 |
| bidding-service (nanti) | 3003 | http://localhost:3003 |
| notification-service (nanti) | 3004 | http://localhost:3004 |
| PostgreSQL | 5432 | localhost:5432 |

Di dalam Docker network, service bisa saling panggil via nama container:
- `http://auth-service:3000`
- `http://bidding-service:3000`
- dst.

---

## Dependency antar Service

```
Semua Service
    └── butuh: identity-and-sso-service (untuk auth)

bidding-service
    └── butuh: project-service (validasi project exists)
    └── butuh: auth-service (get user detail via internal endpoint)

notification-service
    └── dipanggil oleh: bidding-service (kirim notif saat bid accepted)
    └── dipanggil oleh: project-service (kirim notif saat project posted)
```

---

## FAQ untuk Tim Lain

**Q: Apakah aku perlu install bcryptjs dan jsonwebtoken di service aku?**
A: Hanya `jsonwebtoken` untuk verify token. `bcryptjs` tidak perlu, itu urusan auth-service.

**Q: Bagaimana kalau token expired?**
A: Client akan dapat response `401`. Client harus hit `POST /api/auth/refresh` dengan
refresh token untuk dapat access token baru, lalu retry request.

**Q: Bagaimana aku tahu user ID dari request yang masuk?**
A: Setelah middleware `authenticate` dijalankan, akses via `req.user.id`.

**Q: Bagaimana kalau aku butuh data lengkap user (nama, dll) tapi hanya punya ID?**
A: Call internal endpoint: `GET http://auth-service:3000/internal/users/:id`
(Hanya bisa dari dalam Docker network).

**Q: Apakah aku perlu connect ke database auth-service?**
A: TIDAK. Setiap service punya database sendiri. Untuk data user, gunakan
internal endpoint atau andalkan payload JWT yang sudah ada.
