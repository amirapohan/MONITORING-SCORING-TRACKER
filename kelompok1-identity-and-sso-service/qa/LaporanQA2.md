**Status:** ✅ READY TO USE (19 tests)  
**Tanggal:** 13 Mei 2026  
**Framework:** Identity & SSO Service v2.0

### Set Environment di Postman

```
Environment Variables:
  BASE_URL = http://localhost:3000
  accessToken = (auto-set saat login)
  refreshToken = (auto-set saat login)
  client_email = (auto-set saat register client)
  freelancer_email = (auto-set saat register freelancer)
```

### Fully Working Tests (19 tests)

```
1. Health Check (1)
   └─ Cek Status Service ............................ ✅ READY

2. Registrasi (6)
   ├─ Register Client - Valid ..................... ✅ READY
   ├─ Register Freelancer - Valid ................ ✅ READY
   ├─ Register - Nama Kosong (Error) ............ ✅ READY
   ├─ Register - Email Format Salah (Error) .... ✅ READY
   ├─ Register - Password Terlalu Pendek (Error) ✅ READY
   └─ Register - Email Duplicate (Error) ....... ✅ READY

3. Login (3)
   ├─ Login Client - Valid ....................... ✅ READY
   ├─ Login - Password Salah (Error) ........... ✅ READY
   └─ Login - Email Tidak Terdaftar (Error) ... ✅ READY

4. Token Management (1)
   └─ Refresh Token - Get New Access Token .... ✅ READY

5. Logout (2)
   ├─ Logout - Valid Token ..................... ✅ READY
   └─ Logout - Tanpa Token (Error) ............ ✅ READY

6. Profile (6)
   ├─ Lihat Profile - Valid Token ............. ✅ READY
   ├─ Lihat Profile - Tanpa Token (Error) ... ✅ READY
   ├─ Lihat Profile - Token Invalid (Error) .. ✅ READY
   ├─ Update Profile - Ubah Nama ............. ✅ READY
   ├─ Update Profile - Ubah Password ......... ✅ READY
   └─ Update Profile - Tanpa Token (Error) .. ✅ READY

────────────────────────────────
TOTAL: 19 TESTS ✅ ALL READY
```

---

### Base URL

```
v1.0: http://localhost:3001
v2.0: http://localhost:3000 ← YG BENER (aku bingung pakai port sesuai codebase atau bc an kamu iaz)
```

### Roles

```
v1.0: mahasiswa, mitra, admin
v2.0: client, freelancer, admin ← UPDATED

Mapping:
  mahasiswa → client (pencari proyek)
  mitra → freelancer (pemberi proyek)
  admin → admin (unchanged)
```
