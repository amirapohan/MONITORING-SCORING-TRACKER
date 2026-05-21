
const biddingService = require('../services/bidding.service');
const notificationService = require('../../../utils/notification');
const trackerService = require('../../../utils/tracker');
const { responseSuccess, responseError } = require('../../../utils/response');

const isProjectOwner = (project, userId) => (
  String(project.mitra_id) === String(userId)
);

class BiddingController {
  async getBids(req, res) {
    try {
      // Get user info dari auth middleware
      const userId = req.user.id;
      const userType = req.user.type;

      // Fetch bids dengan role-based filtering
      const bids = await biddingService.getBids(userId, userType);

      // Return success response
      return responseSuccess(res, 'Bids retrieved successfully', {
        bids,
        count: bids.length,
        user_type: userType
      }, 200);

    } catch (error) {
      console.error('Error in getBids:', error);
      return responseError(res, error.message, 500, 'SERVER_ERROR');
    }
  }

  async getBidById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return responseError(res, 'Bid ID parameter is required', 400, 'VALIDATION_ERROR');
      }

      const bid = await biddingService.getBidById(id);

      if (!bid) {
        return responseError(res, 'Bid not found', 404, 'BID_NOT_FOUND');
      }

      return responseSuccess(res, 'Bid retrieved successfully', bid, 200);

    } catch (error) {
      console.error('Error in getBidById:', error);
      return responseError(res, 'Internal server error', 500, 'SERVER_ERROR');
    }
  }

  async createBid(req, res) {
    try {
      // --- PERUBAHAN 1: RBAC Lapis 1 (Cek Role) ---
      // Tolak mentah-mentah jika yang request bukan talent
      if (req.user.type !== 'talent') {
        return responseError(res, 'Hanya talent/kelompok yang bisa melakukan bid', 403, 'FORBIDDEN');
      }

      // --- PERUBAHAN 2: Hapus group_id dari destructuring req.body ---
      const { project_id, group_id ,priority, document_url, student_id, tawaran_harga, tawaran_waktu } = req.body;

      // --- PERUBAHAN 3: Paksa group_id pakai ID dari token auth ---
      //const group_id = req.user.id;

      // Validation: Check required fields (group_id sudah pasti ada dari token, jadi tidak perlu dicek lagi di sini)
      if (!project_id || !priority || !document_url || !student_id || !tawaran_harga || !tawaran_waktu) {
        return responseError(res, 'Missing required fields: project_id, priority, document_url, student_id, tawaran_harga, tawaran_waktu', 400, 'VALIDATION_ERROR');
      }

      // Validation: Priority must be positive integer
      if (!Number.isInteger(priority) || priority < 1) {
        return responseError(res, 'Priority must be a positive integer', 400, 'VALIDATION_ERROR');
      }

      // Check if project exists
      const project = await biddingService.getProjectDetails(project_id);
      if (!project) {
        return responseError(res, 'Project not found', 400, 'PROJECT_NOT_FOUND');
      }

      // Check if project is closed
      if (project.status_proyek === 'Closed') {
        return responseError(res, 'Project is closed for bidding', 400, 'PROJECT_CLOSED');
      }

      // Check if group exists
      const group = await biddingService.getGroupDetails(group_id);
      if (!group) {
        return responseError(res, 'Group not found', 400, 'GROUP_NOT_FOUND');
      }

      // Check if student/pendaftar exists
      const student = await biddingService.getStudentDetails(student_id);
      if (!student) {
        return responseError(res, 'Student not found', 400, 'STUDENT_NOT_FOUND');
      }

      // Check if group already bid on this project (uniqueness constraint)
      const existingBid = await biddingService.checkExistingBid(project_id, group_id);
      if (existingBid) {
        return responseError(res, 'Group has already bid on this project', 409, 'DUPLICATE_BID');
      }

      // Create bid with market maker logic
      const bidData = {
        projectId: project_id,
        groupId: group_id, // Aman! Menggunakan ID dari token
        studentId: student_id,
        priority: priority,
        documentUrl: document_url,
        tawaranHarga: tawaran_harga, 
        tawaranWaktu: tawaran_waktu  
      };

      const newBid = await biddingService.createBid(bidData);

      // Update project status if quota reached
      await biddingService.updateProjectStatusIfFull(project_id);

      // Success response
      const message = newBid.status_bid === 'Rejected' 
        ? 'Bid rejected: project quota full' 
        : 'Bid created successfully';

      return responseSuccess(res, message, {
        bid_id: newBid.bid_id,
        group_id: newBid.kelompok_id,
        project_id: newBid.proyek_id,
        status: newBid.status_bid,
        priority: newBid.urutan_prioritas,
        created_at: newBid.waktu_bid
      }, 201);

    } catch (error) {
      console.error('Error in createBid:', error);
      return responseError(res, 'Internal server error', 500, 'SERVER_ERROR');
    }
  }

  async updateBidStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body; // 👈 Notes dihapus dari sini
      const userId = req.user.id;
      const userType = req.user.type;

      // Validasi
      if (!status || !['Accepted', 'Rejected'].includes(status)) {
        return responseError(res, 'Status harus Accepted atau Rejected', 400, 'INVALID_STATUS');
      }

      // Get bid untuk validasi (menggunakan method yang sudah di-rename)
      const bid = await biddingService.checkBidExists(id);
      if (!bid) {
        return responseError(res, 'Bid tidak ditemukan', 404, 'BID_NOT_FOUND');
      }

      // Get project untuk RBAC check
      const project = await biddingService.getProjectDetails(bid.proyek_id);
      
      // RBAC: hanya client pemilik atau admin yang bisa accept/reject
      if (userType !== 'admin' && (userType !== 'client' || !isProjectOwner(project, userId))) {
        return responseError(res, 'Hanya client pemilik proyek atau admin yang bisa mengubah status bid', 403, 'FORBIDDEN');
      }

      // Update bid status (tanpa notes)
      const updated = await biddingService.updateBidStatus(id, status); // 👈 Notes dihapus
      
      // Trigger notification
      await notificationService.sendBidStatusUpdate(bid.kelompok_id, status, project.judul_proyek);

      // 5. TRIGGER TRACKER (Kelompok 4) - HANYA JIKA ACCEPTED
      if (status === 'Accepted') {
        const dealData = {
          deal_id: `DEAL-${bid.proyek_id}-${bid.kelompok_id}`, // Bikin ID unik ala kadarnya
          project_id: bid.proyek_id,
          project_title: project.judul_proyek,
          mitra_id: project.mitra_id,
          group_id: bid.kelompok_id,
          bid_amount: bid.tawaran_harga,
          deal_amount: bid.tawaran_harga, // Deal awal = tawaran bid
          status: 'Accepted',
          timeline: {
            bid_created_at: bid.waktu_bid,
            bid_accepted_at: new Date().toISOString(),
            estimated_completion: bid.tawaran_waktu
          }
        };

        // Fire and forget (kita await tapi kalau error sudah di-handle di utility, jadi tidak bikin API crash)
        await trackerService.sendDealToTracker(dealData);
      }

      return responseSuccess(res, `Bid berhasil di-${status.toLowerCase()}`, {
        bid_id: updated.bid_id,
        status: updated.status_bid,
        updated_at: new Date()
      }, 200);

    } catch (error) {
      console.error('Error in updateBidStatus:', error);
      return responseError(res, error.message, 500, 'SERVER_ERROR');
    }
  }
}

module.exports = new BiddingController();
