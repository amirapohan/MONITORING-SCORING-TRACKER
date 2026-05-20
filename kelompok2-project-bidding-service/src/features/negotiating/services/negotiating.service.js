const pool = require('../../../config/db');

class NegotiatingService {
  // Check if bid exists and get its details (fixed typo: getBitDetails → getBidDetails)
  async getBidDetails(bidId) {
    const query = 'SELECT * FROM bid WHERE bid_id = $1';
    const result = await pool.query(query, [bidId]);
    return result.rows[0];
  }

  // Create a new negotiation (fixed typo: bit_Id → bid_id)
  async createNegotiation(negotiationData) {
    const { bid_id, response_harga, response_waktu, role_ } = negotiationData;

    const query = `
      INSERT INTO negosiasi (bid_id, response_harga, response_waktu, role_)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await pool.query(query, [
      bid_id,
      response_harga,
      response_waktu,
      role_
    ]);

    return result.rows[0];
  }

  // Delete a negotiation by id (fixed: checkArr.rows bug — getNegotiationsByBidId already returns rows)
  async deleteNegotiation(negotiationId, bidId) {
    const query = 'DELETE FROM negosiasi WHERE nego_id = $1 RETURNING *';

    // Check if there is a negotiation from opposite role before deleting
    const negotiations = await this.getNegotiationsByBidId(bidId);
    const negoToDelete = negotiations.find(nego => nego.nego_id === negotiationId);

    if (!negoToDelete) {
      throw new Error('Negotiation not found for this bid');
    }

    const oppositeRole = negoToDelete.role_ === 'Kelompok' ? 'Mitra' : 'Kelompok';
    const hasOppositeRole = negotiations.some(nego => nego.role_ === oppositeRole);

    if (hasOppositeRole) {
      // Check if the most recent negotiation is from the opposite role
      // If so, we can't delete because they already replied
      if (negotiations[0].role_ === oppositeRole) {
        throw new Error(`Cannot delete: ${oppositeRole} has already replied to this negotiation.`);
      }
    }

    const deleteResult = await pool.query(query, [negotiationId]);
    return deleteResult.rows[0];
  }

  // Get all negotiations (NEW — was placeholder before)
  async getAllNegotiations() {
    const query = `
      SELECT n.*, b.proyek_id, b.kelompok_id, b.status_bid
      FROM negosiasi n
      JOIN bid b ON n.bid_id = b.bid_id
      ORDER BY n.created_at DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  // Get a negotiation by its ID
  async getNegotiationById(negoId) {
    const query = 'SELECT * FROM negosiasi WHERE nego_id = $1';
    const result = await pool.query(query, [negoId]);
    return result.rows[0];
  }

  // Update negotiation status (accept/reject counter-offer)
  async updateNegotiationStatus(negoId, status) {
    const query = `
      UPDATE negosiasi 
      SET status = $1
      WHERE nego_id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [status, negoId]);
    return result.rows[0];
  }

  // Update bid status final & sinkronisasi harga/waktu deal
  async updateBidStatusFinal(bidId, status, finalHarga = null, finalWaktu = null) {
    let query;
    let params;

    // Jika deal (Accepted) dan ada nominal/waktu baru, update semuanya
    if (status === 'Accepted' && finalHarga !== null && finalWaktu !== null) {
      query = `
        UPDATE bid 
        SET status_bid = $1, tawaran_harga = $2, tawaran_waktu = $3
        WHERE bid_id = $4
        RETURNING *
      `;
      params = [status, finalHarga, finalWaktu, bidId];
    } else {
      // Jika hanya merubah status (misal: ditolak/Rejected)
      query = `
        UPDATE bid 
        SET status_bid = $1
        WHERE bid_id = $2
        RETURNING *
      `;
      params = [status, bidId];
    }

    const result = await pool.query(query, params);
    return result.rows[0];
  }

  // Get project details (for RBAC check)
  async getProjectDetails(projectId) {
    const query = 'SELECT * FROM proyek WHERE proyek_id = $1';
    const result = await pool.query(query, [projectId]);
    return result.rows[0];
  }

  async getNegotiationsByBidId(bidId) {
    try {
      const query = `
        SELECT 
          nego_id,
          bid_id,
          response_harga,
          response_waktu,
          role_,
          status,
          created_at
        FROM negosiasi
        WHERE bid_id = $1
        ORDER BY created_at DESC
      `;
      const result = await pool.query(query, [bidId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching negotiations:', error);
      throw error;
    }
  }
}

module.exports = new NegotiatingService();
