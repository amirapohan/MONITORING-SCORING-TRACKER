
CREATE TYPE status_proyek_enum AS ENUM ('Open', 'Full', 'Closed');
-- Tambahkan 'Queued' ke dalam ENUM
CREATE TYPE status_bid_enum AS ENUM ('Pending', 'Accepted', 'Rejected', 'Queued');
CREATE TYPE project_skill_enum AS ENUM (
    'Frontend',
    'Backend',
    'UI/UX',
    'Mobile',
    'Database',
    'DevOps',
    'Data Science',
    'Machine Learning',
    'Cybersecurity',
    'QA Testing'
);
CREATE TYPE user_role_enum AS ENUM ('talent', 'client', 'admin');

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
    skills project_skill_enum[] NOT NULL,
    requirements TEXT,          -- berupa opsi gitu
    kuota_maksimal INT NOT NULL DEFAULT 1,
    budget_awal DECIMAL(15, 2) NOT NULL,
    tanggal_selesai DATE, 
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
    kelompok_id VARCHAR(50), --Bisa NULL jika perorangan
    pendaftar_id VARCHAR(50) NOT NULL, -- Mahasiswa yang mewakili/perorangan
    status_bid status_bid_enum DEFAULT 'Queued',
    urutan_prioritas INT NOT NULL, -- Pilihan 1, 2, 3, dst.
    dokumen_url TEXT NOT NULL,
    tawaran_harga DECIMAL(15, 2) NOT NULL,
    tawaran_waktu DATE NOT NULL,
    waktu_bid TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_proyek FOREIGN KEY(proyek_id) REFERENCES proyek(proyek_id),
    CONSTRAINT fk_kelompok FOREIGN KEY(kelompok_id) REFERENCES kelompok(kelompok_id),
    CONSTRAINT fk_pendaftar FOREIGN KEY(pendaftar_id) REFERENCES mahasiswa(mahasiswa_id),
    
    -- Mencegah 1 kelompok mendaftar ke proyek yang SAMA lebih dari 1 kali
    CONSTRAINT unique_bid_per_kelompok UNIQUE (proyek_id, kelompok_id)
);

-- Tambahkan ENUM ini di bagian atas (bersama ENUM lainnya)
CREATE TYPE status_nego_enum AS ENUM ('Pending', 'Accepted', 'Rejected', 'Countered');

-- Lalu ubah definisi tabel negosiasi kamu menjadi seperti ini:
CREATE TABLE negosiasi(
    nego_id SERIAL PRIMARY KEY,
    bid_id INT NOT NULL,
    response_harga DECIMAL(15, 2) NOT NULL,
    response_waktu DATE NOT NULL,
    role_ user_role_enum NOT NULL,
    status status_nego_enum DEFAULT 'Pending', -- 👈 INI TAMBAHANNYA
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bid FOREIGN KEY(bid_id) REFERENCES bid(bid_id)  
);
