# Project APL - Communication & Automation Service  
**Kelompok 5 — “Broadcaster”**

Communication & Automation Service adalah salah satu microservice dalam ekosistem ProjectHub, sebuah platform terintegrasi berbasis microservices untuk mengelola proses bidding judul Capstone di lingkungan akademik.

Service ini berperan sebagai pusat komunikasi sistem yang menangani:

- Pengumuman resmi dari panitia/dosen
- Notifikasi otomatis ketika terjadi perubahan status bidding
- Otomatisasi generate dokumen Surat Tugas (PDF)

---

# 🚀 Fitur Utama

## MVP
- Manajemen dan distribusi pengumuman
- Download dokumen pengumuman PDF

## Medium
- Email notifikasi otomatis ketika status bidding berubah
- Logging notifikasi untuk audit & idempotency

## Maximum
- Generate Surat Tugas otomatis dalam format PDF
- Download Surat Tugas

---

# 🏗 Arsitektur

Menggunakan:

- **Event-Driven Architecture (EDA)**
- **REST API + Redis Pub/Sub**
- **Microservices Architecture**

## Tech Stack

| Layer | Teknologi |
|------|-----------|
Backend | Node.js |
Database | PostgreSQL |
Cache / Event Bus | Redis |
PDF Generator | WeasyPrint |
Email Service | Nodemailer |
Gateway | Nginx |
Containerization | Docker |

---

# Penamaan Branching

### main branch
branch yang terintegrasi dengan kelompok lain.

### develop branch
internal testing branch

### fitur branch
```bash
<type>/<short_description>.<nama>
```
contoh: feature/navbar.joko

---

# 📌 Business Role
Service ini berfungsi sebagai **Communication & Automation Layer** pada ekosistem ProjectHub:

- Broadcast pengumuman ke seluruh pengguna
- Subscribe event dari service lain
- Trigger notifikasi otomatis
- Generate dokumen administratif

---

# 🧩 Functional Requirements

## Announcement Module
- Upload dokumen pengumuman
- Lihat daftar pengumuman
- Download pengumuman

## Notification Module
- Terima event perubahan status bidding
- Kirim email otomatis Accepted / Rejected
- Logging notifikasi dan deduplikasi event

## Automation Module
- Generate Surat Tugas PDF
- Download surat tugas

---

## Prerequisites
Pastikan terinstall:

- Docker
- Docker Compose
- Node.js
- PostgreSQL
- Redis

---

# Authors
Anggota Kelompok 5  

- Hanifah 
- Abe
- Tsaniya
- Danella
- Rafa
- Athaya
