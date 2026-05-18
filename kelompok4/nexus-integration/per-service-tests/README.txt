============================================================
 NEXUS — PER-SERVICE TEST SUITE (use-case lengkap per kelompok)
 Pelengkap untuk: ../e2e-test.sh (yang hanya menguji alur lintas-service)
============================================================

KENAPA FOLDER INI ADA
------------------------------------------------------------
../e2e-test-features.txt + ../e2e-test.sh hanya menguji JALUR
INTEGRASI happy-path (register -> login -> authz -> milestone ->
event). Itu BUKAN katalog fitur lengkap. Folder ini menutup
sisanya: hampir SEMUA endpoint HTTP tiap kelompok diuji di sini.

Setiap kelompok punya 2 file:
  kN-<svc>-test.sh        skrip uji (curl, lewat gateway)
  kN-<svc>-features.txt   catatan fitur + payload (gaya e2e-test-features.txt)

  k1-auth-test.sh      / k1-auth-features.txt      (Identity & SSO)
  k2-bidding-test.sh   / k2-bidding-features.txt   (Project Bidding)
  k3-match-test.sh     / k3-match-features.txt     (Team Matching)
  k4-tracker-test.sh   / k4-tracker-features.txt   (Monitoring & Scoring)
  k5-notify-test.sh    / k5-notify-features.txt    (Notification)

  run-all.sh           menjalankan kelima skrip berurutan + ringkasan

CARA PAKAI
------------------------------------------------------------
Prasyarat: `docker compose up -d` di ../ sudah jalan & semua healthy.

  ./run-all.sh                 # semua kelompok
  ./k3-match-test.sh           # satu kelompok saja
  BASE=http://localhost ./k1-auth-test.sh

Setiap skrip BISA dijalankan sendiri (mandiri) — yang butuh JWT
akan register+login ke K1 sendiri.

KONVENSI HASIL
------------------------------------------------------------
  PASS      fitur jalan sesuai harapan
  FAIL      fitur tidak sesuai harapan (bug nyata / service mati)
  SKIP      tidak diuji karena butuh konfigurasi yang tak diketahui
            skrip (mis. internal API key, akun admin, env Supabase)
  KNOWN-BUG perilaku salah yang MEMANG sudah ada di kode kelompok ybs
            (skrip mengonfirmasi bug itu masih ada — lihat .txt)

VARIABEL ENV OPSIONAL (untuk membuka test yang di-SKIP)
------------------------------------------------------------
  INTERNAL_API_KEY   key untuk endpoint /auth/internal/* (K1)
                     default coba "change-this-internal-api-key"
  K3_SERVICE_KEY     key untuk /match/internal/check-team (K3)
  ADMIN_EMAIL/ADMIN_PASSWORD  akun admin K1 (buka test admin K1)

CATATAN PENTING
------------------------------------------------------------
- Test hanya MEMBACA & MEMBUAT data; tidak mereset DB. Email auth
  dibuat unik tiap run (e2e_<timestamp>@nexus.dev) supaya idempoten.
- K2 (bidding): POST /api/bidding butuh data referensi di DB
  (mitra/proyek/kelompok/mahasiswa) yang TIDAK di-seed otomatis.
  Tanpa seed, skrip tetap membuktikan endpoint hidup via error
  terstruktur (PROJECT_NOT_FOUND dsb).
- K4 (tracker): upload dokumen/submission-file butuh env
  SUPABASE_*; tanpa itu di-SKIP. Submission-LINKS tetap diuji penuh.
- K3: ada 3 bug nyata yang ditandai KNOWN-BUG (lihat .txt-nya).
============================================================
