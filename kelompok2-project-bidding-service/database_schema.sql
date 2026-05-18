-- 1. Buat ENUM untuk tipe status agar data konsisten
CREATE TYPE status_proyek_enum AS ENUM ('Open', 'Full', 'Closed');
-- Tambahkan 'Queued' ke dalam ENUM
CREATE TYPE status_bid_enum AS ENUM ('Pending', 'Accepted', 'Rejected', 'Queued');

-- 2. Tabel Mitra (Pemilik Proyek)
CREATE TABLE mitra (
    mitra_id SERIAL PRIMARY KEY,
    nama_mitra VARCHAR(255) NOT NULL,
    kontak_mitra VARCHAR(255) NOT NULL
);

-- 3. Tabel Proyek
CREATE TABLE proyek (
    proyek_id SERIAL PRIMARY KEY,
    mitra_id INT NOT NULL,
    judul_proyek VARCHAR(255) NOT NULL,
    deskripsi_proyek TEXT NOT NULL,
    requirements TEXT,
    kuota_maksimal INT NOT NULL DEFAULT 1,
    status_proyek status_proyek_enum DEFAULT 'Open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mitra
      FOREIGN KEY(mitra_id) 
      REFERENCES mitra(mitra_id)
      ON DELETE CASCADE
);

-- 4. Tabel Referensi (Data dari Kelompok 1 & 3)
-- Kelompok 2 hanya butuh tabel ini untuk menjaga referensi ID
CREATE TABLE kelompok (
    kelompok_id VARCHAR(50) PRIMARY KEY, -- Pakai VARCHAR jika dari luar tipenya UUID
    nama_kelompok VARCHAR(255) NOT NULL
);

CREATE TABLE mahasiswa (
    mahasiswa_id VARCHAR(50) PRIMARY KEY,
    nama_lengkap VARCHAR(255),
    nim VARCHAR(20)
);

-- 5. Tabel Bid (Inti dari Transaksi Bidding)
CREATE TABLE bid (
    bid_id SERIAL PRIMARY KEY,
    proyek_id INT NOT NULL,
    kelompok_id VARCHAR(50) NOT NULL,
    pendaftar_id VARCHAR(50) NOT NULL, -- Mahasiswa yang mewakili
    status_bid status_bid_enum DEFAULT 'Queued',
    urutan_prioritas INT NOT NULL, -- Pilihan 1, 2, 3, dst.
    dokumen_url TEXT NOT NULL,
    waktu_bid TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_proyek FOREIGN KEY(proyek_id) REFERENCES proyek(proyek_id),
    CONSTRAINT fk_kelompok FOREIGN KEY(kelompok_id) REFERENCES kelompok(kelompok_id),
    CONSTRAINT fk_pendaftar FOREIGN KEY(pendaftar_id) REFERENCES mahasiswa(mahasiswa_id),
    
    -- Mencegah 1 kelompok mendaftar ke proyek yang SAMA lebih dari 1 kali
    CONSTRAINT unique_bid_per_kelompok UNIQUE (proyek_id, kelompok_id)
);