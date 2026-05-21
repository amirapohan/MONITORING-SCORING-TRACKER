const pool = require('../../../config/db');

class NegotiatingService {
  async getBidDetails(bidId) {
    const query = 'SELECT * FROM bid WHERE bid_id = $1';
    const result = await pool.query(query, [bidId]);
    return result.rows[0];
  }
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
  async deleteNegotiation(negotiationId, bidId) {
    const query = 'DELETE FROM negosiasi WHERE nego_id = $1 RETURNING *';
    const negotiations = await this.getNegotiationsByBidId(bidId);
    const negoToDelete = negotiations.find(nego => nego.nego_id === negotiationId);

    if (!negoToDelete) {
      throw new Error('Negotiation not found for this bid');
    }

    const oppositeRole = negoToDelete.role_ === 'talent' ? 'client' : 'talent';
    const hasOppositeRole = negotiations.some(nego => nego.role_ === oppositeRole);

    if (hasOppositeRole) {
      if (negotiations[0].role_ === oppositeRole) {
        throw new Error(`Cannot delete: ${oppositeRole} has already replied to this negotiation.`);
      }
    }

    const deleteResult = await pool.query(query, [negotiationId]);
    return deleteResult.rows[0];
  }
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
  async getNegotiationById(negoId) {
    const query = 'SELECT * FROM negosiasi WHERE nego_id = $1';
    const result = await pool.query(query, [negoId]);
    return result.rows[0];
  }
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
  async updateBidStatusFinal(bidId, status, finalHarga = null, finalWaktu = null) {
    let query;
    let params;
    if (status === 'Accepted' && finalHarga !== null && finalWaktu !== null) {
      query = `
        UPDATE bid 
        SET status_bid = $1, tawaran_harga = $2, tawaran_waktu = $3
        WHERE bid_id = $4
        RETURNING *
      `;
      params = [status, finalHarga, finalWaktu, bidId];
    } else {
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
