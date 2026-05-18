# Project Bidding Service for Capstone Platform

Microservice dari sistem **Capstone Platform**. Repositori ini memuat *source code* dan dokumentasi teknis untuk layanan Project Bidding.

*Bagian dari projek Arsitektur Perangkat Lunak.*

## Susunan Tim

| Nama | NIM | Role |
| :--- | :--- | :--- |
| **Muhammad Affandi Argya Bagaskara** | 24/538984/TK/59778 | Product Owner |
| **Christian Kevin Andhika Danidaiva** | 23/513576/TK/56433 | DevOps Engineer |
| **Ramzi Alfito Rizky** | 24/540550/TK/60008 | Backend Engineer |
| **Bayu Rahmat Kurnia** | 24/533736/TK/59139 | Backend Engineer |
| **Moses Saidasdo Purba** | 23/523274/TK/57854 | Documentation Engineer |
| **Akio Afifian Ahsan** | 24/542230/TK/60198 | Quality Assurance |

---

## Getting Started

Jalankan environment setiap mulai sesi pengembangan lokal
```bash
docker compose watch
```

Matikan environment setelah sesi pengembangan selesai
```bash
docker compose down
```

## Instalasi package

```bash
npm install <nama-package>
```
or

Jika tidak mengunduh npm di komputer:
```bash
docker compose exec api npm install <nama-package>
```

## Workflow

Dilarang melakukan *push* atau *commit* langsung ke `main`.

**1. Sinkronisasi main branch:**
```bash
git switch main
git pull origin main
```

**2. Pindah ke branch untuk pengembangan fitur:**
```bash
git switch -c feat/[nama-fitur].[nama developer]  # Untuk membuat branch baru
```
or
```bash
git switch feat/[nama-fitur].[nama developer] # Jika branch sudah ada
git pull --rebase origin main
```

**3. Code:** 

Setiap kode di-save, perubahan akan langsung disinkronisasi oleh Docker dan dapat langsung dilihat

**4. Commit:**
```bash
git add .
git status # Pastikan tidak ada unwanted file
git commit -m "feat: [deskripsi fitur]"
```

**5. Pull perubahan di main:**
```bash
git pull --rebase origin main
```

**6. Push ke repositori:**
```bash
git push origin feat/[nama-fitur].[nama-developer]
```

**7. Pull Request (PR):**
Ajukan PR ke cabang `main`. Wajib mendapatkan persetujuan (*approval*) minimal dari 1 anggota tim sebelum di-*merge*.

## Penamaan Branch
* **Fitur:** `feat/[nama-fitur].[nama-developer]` (Ex: `feat/create-bid.bayu`)
* **Bugfix:** `bugfix/[nama-bug].[nama-developer]` (Ex: `bugfix/fix-validation.bayu`)
* **Dokumentasi:** `docs/[nama-dokumen].[nama-developer]` (Ex: `docs/api-spec.bayu`)

## Konvensi Commit Message
Gunakan standar [Conventional Commits](https://www.conventionalcommits.org/):
* `feat:` Penambahan fitur baru
* `fix:` Perbaikan bug
* `docs:` Pembaruan dokumentasi
* `refactor:` Restrukturisasi kode tanpa ubah fungsi
* `chore:` Penyesuaian konfigurasi atau dependensi
#### Commit early, commit often
