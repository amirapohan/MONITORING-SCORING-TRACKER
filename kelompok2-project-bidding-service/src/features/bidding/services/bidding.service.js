const pool = require('../../../config/db');

class BiddingService {
  async getProjectDetails(projectId) {
    const query = 'SELECT * FROM proyek WHERE proyek_id = $1';
    const result = await pool.query(query, [projectId]);
    return result.rows[0];
  }
  async getGroupDetails(groupId) {
    const query = 'SELECT * FROM kelompok WHERE kelompok_id = $1';
    const result = await pool.query(query, [groupId]);
    return result.rows[0];
  }
  async getStudentDetails(studentId) {
    const query = 'SELECT * FROM mahasiswa WHERE mahasiswa_id = $1';
    const result = await pool.query(query, [studentId]);
    return result.rows[0];
  }
  async ensureGroupExists(groupId, groupName) {
    const query = `
      INSERT INTO kelompok (kelompok_id, nama_kelompok)
      VALUES ($1, $2)
      ON CONFLICT (kelompok_id) DO NOTHING
    `;
    await pool.query(query, [groupId, groupName]);
  }
  async ensureStudentExists(studentId, studentName, nim) {
    const query = `
      INSERT INTO mahasiswa (mahasiswa_id, nama_lengkap, nim)
      VALUES ($1, $2, $3)
      ON CONFLICT (mahasiswa_id) DO NOTHING
    `;
    await pool.query(query, [studentId, studentName, nim]);
  }
  async countProjectBids(projectId) {
    const query = `
      SELECT COUNT(*) as total 
      FROM bid 
      WHERE proyek_id = $1 AND status_bid IN ('Accepted', 'Pending')
    `;
    const result = await pool.query(query, [projectId]);
    return parseInt(result.rows[0].total, 10);
  }
  async checkExistingBid(projectId, groupId) {
    const query = `
      SELECT * FROM bid 
      WHERE proyek_id = $1 AND kelompok_id = $2
    `;
    const result = await pool.query(query, [projectId, groupId]);
    return result.rows[0];
  }
  async createBid(bidData) {
    return this.createBidWithTransactionLock(bidData);
  }
  async checkBidExists(bidId) {
    const query = 'SELECT * FROM bid WHERE bid_id = $1';
    const result = await pool.query(query, [bidId]);
    return result.rows[0];
  }
  async updateBidStatus(bidId, status) {
    if (status !== 'Accepted') {
      const query = 'UPDATE bid SET status_bid = $1 WHERE bid_id = $2 RETURNING *';
      const result = await pool.query(query, [status, bidId]);
      return result.rows[0];
    }
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      const getBidQuery = 'SELECT proyek_id FROM bid WHERE bid_id = $1';
      const bidResult = await client.query(getBidQuery, [bidId]);
      if (bidResult.rows.length === 0) throw new Error('Bid tidak ditemukan');
      const projectId = bidResult.rows[0].proyek_id;
      const projectQuery = 'SELECT kuota_maksimal FROM proyek WHERE proyek_id = $1 FOR UPDATE';
      const projectResult = await client.query(projectQuery, [projectId]);
      const maxQuota = projectResult.rows[0].kuota_maksimal;
      const countQuery = `
        SELECT COUNT(*) as total_accepted 
        FROM bid 
        WHERE proyek_id = $1 AND status_bid = 'Accepted'
      `;
      const countResult = await client.query(countQuery, [projectId]);
      const currentAccepted = parseInt(countResult.rows[0].total_accepted, 10);
      if (currentAccepted >= maxQuota) {
        throw new Error('Gagal: Kuota proyek sudah penuh, tidak bisa menerima bid lagi.');
      }
      const updateBidQuery = `
        UPDATE bid 
        SET status_bid = $1 
        WHERE bid_id = $2 
        RETURNING *
      `;
      const updatedBid = await client.query(updateBidQuery, [status, bidId]);
      if (currentAccepted + 1 >= maxQuota) {
        await client.query(
          "UPDATE proyek SET status_proyek = 'Full' WHERE proyek_id = $1", 
          [projectId]
        );
      }

      await client.query('COMMIT');
      return updatedBid.rows[0];

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async updateProjectStatusIfFull(projectId) {
    const project = await this.getProjectDetails(projectId);
    const currentBids = await this.countProjectBids(projectId);

    if (currentBids >= project.kuota_maksimal && project.status_proyek !== 'Full') {
      const updateQuery = `
        UPDATE proyek 
        SET status_proyek = 'Full' 
        WHERE proyek_id = $1
        RETURNING *
      `;
      const result = await pool.query(updateQuery, [projectId]);
      return result.rows[0];
    }

    return project;
  }
  async getBidById(bidId) {
    const query = `
      SELECT 
        b.bid_id,
        b.proyek_id,
        b.kelompok_id,
        b.pendaftar_id,
        b.status_bid,
        b.urutan_prioritas,
        b.dokumen_url,
        b.tawaran_harga,
        b.tawaran_waktu,
        b.waktu_bid,
        p.judul_proyek,
        p.status_proyek,
        m.nama_mitra
      FROM bid b
      JOIN proyek p ON b.proyek_id = p.proyek_id
      JOIN mitra m ON p.mitra_id = m.mitra_id
      WHERE b.bid_id = $1
    `;
    const result = await pool.query(query, [bidId]);
    return result.rows[0];
  }
  async getBids(userId, userType) {
    try {
      let query;
      let params;

      if (userType === 'client') {
        query = `
          SELECT 
            b.bid_id,
            b.proyek_id,
            b.kelompok_id,
            b.pendaftar_id,
            b.status_bid,
            b.urutan_prioritas,
            b.dokumen_url,
            b.waktu_bid,
            p.judul_proyek,
            p.status_proyek,
            m.nama_mitra
          FROM bid b
          JOIN proyek p ON b.proyek_id = p.proyek_id
          JOIN mitra m ON p.mitra_id = m.mitra_id
          WHERE p.mitra_id = $1
          ORDER BY b.waktu_bid DESC
        `;
        params = [userId];

      } else if (userType === 'talent') {
        query = `
          SELECT 
            b.bid_id,
            b.proyek_id,
            b.kelompok_id,
            b.pendaftar_id,
            b.status_bid,
            b.urutan_prioritas,
            b.dokumen_url,
            b.waktu_bid,
            p.judul_proyek,
            p.status_proyek,
            m.nama_mitra
          FROM bid b
          JOIN proyek p ON b.proyek_id = p.proyek_id
          JOIN mitra m ON p.mitra_id = m.mitra_id
          WHERE b.kelompok_id = $1
          ORDER BY b.waktu_bid DESC
        `;
        params = [userId];

      } else if (userType === 'admin') {
        query = `
          SELECT 
            b.bid_id,
            b.proyek_id,
            b.kelompok_id,
            b.pendaftar_id,
            b.status_bid,
            b.urutan_prioritas,
            b.dokumen_url,
            b.waktu_bid,
            p.judul_proyek,
            p.status_proyek,
            m.nama_mitra
          FROM bid b
          JOIN proyek p ON b.proyek_id = p.proyek_id
          JOIN mitra m ON p.mitra_id = m.mitra_id
          ORDER BY b.waktu_bid DESC
        `;
        params = [];

      } else {
        throw new Error(`Invalid user type: ${userType}`);
      }

      const result = await pool.query(query, params);
      return result.rows;

    } catch (error) {
      console.error('Error in getBids:', error);
      throw error;
    }
  }

  async createBidWithTransactionLock(bidData) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      await client.query(
        'SELECT * FROM proyek WHERE proyek_id = $1 FOR UPDATE',
        [bidData.projectId]
      );
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM bid 
        WHERE proyek_id = $1 AND status_bid IN ('Accepted', 'Pending')
      `;
      const countResult = await client.query(countQuery, [bidData.projectId]);
      const currentBids = parseInt(countResult.rows[0].total, 10);
      const projectQuery = 'SELECT * FROM proyek WHERE proyek_id = $1';
      const projectResult = await client.query(projectQuery, [bidData.projectId]);
      const project = projectResult.rows[0];
      let bidStatus = 'Queued';
      if (currentBids >= project.kuota_maksimal) {
        bidStatus = 'Rejected';
      }
      const insertQuery = `
        INSERT INTO bid (proyek_id, kelompok_id, pendaftar_id, status_bid, urutan_prioritas, dokumen_url, tawaran_harga, tawaran_waktu)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      
      const insertResult = await client.query(insertQuery, [
        bidData.projectId,
        bidData.groupId,
        bidData.studentId,
        bidStatus,
        bidData.priority,
        bidData.documentUrl,
        bidData.tawaranHarga,
        bidData.tawaranWaktu
      ]);
      if (currentBids + 1 >= project.kuota_maksimal && project.status_proyek !== 'Full') {
        await client.query(
          'UPDATE proyek SET status_proyek = $1 WHERE proyek_id = $2',
          ['Full', bidData.projectId]
        );
      }
      await client.query('COMMIT');
      
      return insertResult.rows[0];
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in createBidWithTransactionLock:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new BiddingService();
