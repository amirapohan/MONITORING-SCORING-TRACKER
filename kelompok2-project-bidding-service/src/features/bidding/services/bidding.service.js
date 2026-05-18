const pool = require('../../../config/db');

class BiddingService {
  // Check if project exists and get its details
  async getProjectDetails(projectId) {
    const query = 'SELECT * FROM proyek WHERE proyek_id = $1';
    const result = await pool.query(query, [projectId]);
    return result.rows[0];
  }

  // Check if group exists
  async getGroupDetails(groupId) {
    const query = 'SELECT * FROM kelompok WHERE kelompok_id = $1';
    const result = await pool.query(query, [groupId]);
    return result.rows[0];
  }

  // Check if student/pendaftar exists
  async getStudentDetails(studentId) {
    const query = 'SELECT * FROM mahasiswa WHERE mahasiswa_id = $1';
    const result = await pool.query(query, [studentId]);
    return result.rows[0];
  }

  // Count existing bids for a project (accepted/pending bids)
  async countProjectBids(projectId) {
    const query = `
      SELECT COUNT(*) as total 
      FROM bid 
      WHERE proyek_id = $1 AND status_bid IN ('Accepted', 'Pending')
    `;
    const result = await pool.query(query, [projectId]);
    return parseInt(result.rows[0].total, 10);
  }

  // Check if group already bid on this project (uniqueness)
  async checkExistingBid(projectId, groupId) {
    const query = `
      SELECT * FROM bid 
      WHERE proyek_id = $1 AND kelompok_id = $2
    `;
    const result = await pool.query(query, [projectId, groupId]);
    return result.rows[0];
  }

  // Create a new bid with market maker logic
  async createBid(bidData) {
    const { projectId, groupId, studentId, priority, documentUrl } = bidData;

    // Determine bid status based on project quota
    const currentBids = await this.countProjectBids(projectId);
    const project = await this.getProjectDetails(projectId);
    
    let bidStatus = 'Queued';
    if (currentBids >= project.kuota_maksimal) {
      bidStatus = 'Rejected';
    }

    const query = `
      INSERT INTO bid (proyek_id, kelompok_id, pendaftar_id, status_bid, urutan_prioritas, dokumen_url)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await pool.query(query, [
      projectId,
      groupId,
      studentId,
      bidStatus,
      priority,
      documentUrl
    ]);

    return result.rows[0];
  }

  // Update project status to 'Full' if quota is reached
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
}

module.exports = new BiddingService();
