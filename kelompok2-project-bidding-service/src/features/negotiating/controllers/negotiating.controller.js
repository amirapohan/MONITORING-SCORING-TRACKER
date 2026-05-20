const negotiatingService = require('../services/negotiating.service');
const notificationService = require('../../../utils/notification');
const trackerService = require('../../../utils/tracker');
const { getDigitCount } = require('../../../helper_function/functions');
const { responseSuccess, responseError } = require('../../../utils/response');

class NegotiatingController {
  async createNegotiation(req, res) {
    try {
      const { bid_id } = req.params;
      // PERUBAHAN: Hapus role_ dari destructuring req.body
      const { response_harga, response_waktu } = req.body;
      const userId = req.user.id;
      const userType = req.user.type;

      // Validation: Check required fields (hapus role_ dari pengecekan)
      if (!bid_id || !response_harga || !response_waktu) {
        return responseError(res, 'Missing required fields: bid_id (URL param), response_harga, response_waktu', 400, 'VALIDATION_ERROR');
      }

      // Check if bid exists
      const bid = await negotiatingService.getBidDetails(bid_id);
      if (!bid) {
        return responseError(res, 'Bid not found', 404, 'BID_NOT_FOUND');
      }

      // PERUBAHAN: Ambil data project untuk mengecek kepemilikan Mitra
      const project = await negotiatingService.getProjectDetails(bid.proyek_id);

      // PERUBAHAN: Tentukan role otomatis dan RBAC Ownership Check
      let role_;
      if (userType === 'mitra') {
        if (String(project.mitra_id) !== String(userId)) {
          return responseError(res, 'Unauthorized: Ini bukan proyek Anda', 403, 'FORBIDDEN');
        }
        role_ = 'Mitra';
      } else if (userType === 'talent') {
        if (String(bid.kelompok_id) !== String(userId)) {
          return responseError(res, 'Unauthorized: Ini bukan bid kelompok Anda', 403, 'FORBIDDEN');
        }
        role_ = 'Kelompok';
      } else {
        return responseError(res, 'Invalid user type', 403, 'FORBIDDEN');
      }

      // Validation: response_harga must be positive number
      if (!isFinite(response_harga) || response_harga < 0 || getDigitCount(response_harga) > 15) {
        return responseError(res, 'response_harga must be a positive number with up to 15 digits', 400, 'INVALID_RESPONSE_HARGA');
      }

      // Validation: response_waktu must be a valid date string (YYYY-MM-DD)
      const parsedDate = new Date(response_waktu);
      if (isNaN(parsedDate.getTime())) {
        return responseError(res, 'response_waktu must be in valid date format (YYYY-MM-DD)', 400, 'INVALID_RESPONSE_WAKTU');
      }

      // Check if project is closed (bid rejected)
      if (bid.status_bid === 'Rejected') {
        return responseError(res, 'Cannot negotiate: bid has been rejected', 400, 'BID_REJECTED');
      }

      // Create negotiation
      const negotiationData = {
        bid_id: bid_id,
        response_harga: response_harga,
        response_waktu: response_waktu,
        role_: role_ // Menggunakan role yang sudah digenerate sistem di atas
      };

      const newNegotiation = await negotiatingService.createNegotiation(negotiationData);

      // Success response
      return responseSuccess(res, 'Negotiation created successfully', {
        nego_id: newNegotiation.nego_id,
        bid_id: newNegotiation.bid_id,
        response_harga: newNegotiation.response_harga,
        response_waktu: newNegotiation.response_waktu,
        role_: newNegotiation.role_,
        created_at: newNegotiation.created_at
      }, 201);

    } catch (error) {
      console.error('Error in createNegotiation:', error);
      return responseError(res, 'Internal server error', 500, 'SERVER_ERROR');
    }
  }

  async getAllNegotiations(req, res) {
    try {
      const negotiations = await negotiatingService.getAllNegotiations();

      return responseSuccess(res, 'Negotiations retrieved successfully', {
        negotiations,
        count: negotiations.length
      }, 200);

    } catch (error) {
      console.error('Error in getAllNegotiations:', error);
      return responseError(res, 'Internal server error', 500, 'SERVER_ERROR');
    }
  }

  async getNegotiationsByBidId(req, res) {
    try {
      const { bid_id } = req.params;

      if (!bid_id) {
        return responseError(res, 'bid_id parameter is required', 400, 'VALIDATION_ERROR');
      }

      // Check if bid exists
      const bid = await negotiatingService.getBidDetails(bid_id);
      if (!bid) {
        return responseError(res, 'Bid not found', 404, 'BID_NOT_FOUND');
      }

      const negotiations = await negotiatingService.getNegotiationsByBidId(bid_id);

      return responseSuccess(res, 'Negotiations retrieved successfully', {
        bid_id: parseInt(bid_id),
        negotiations,
        count: negotiations.length
      }, 200);

    } catch (error) {
      console.error('Error in getNegotiationsByBidId:', error);
      return responseError(res, 'Internal server error', 500, 'SERVER_ERROR');
    }
  }

  async deleteNegotiation(req, res) {
    try {
      const { nego_id, bid_id } = req.body;

      if (!nego_id || !bid_id) {
        return responseError(res, 'Missing required fields: nego_id, bid_id', 400, 'VALIDATION_ERROR');
      }

      // Check if negotiation exists
      const negotiation = await negotiatingService.getNegotiationById(nego_id);
      if (!negotiation) {
        return responseError(res, 'Negotiation not found', 404, 'NEGOTIATION_NOT_FOUND');
      }

      const deleted = await negotiatingService.deleteNegotiation(nego_id, bid_id);

      return responseSuccess(res, 'Negotiation deleted successfully', {
        deleted_negotiation: deleted
      }, 200);

    } catch (error) {
      console.error('Error in deleteNegotiation:', error);

      // Handle specific business logic errors from service
      if (error.message.includes('Cannot delete')) {
        return responseError(res, error.message, 400, 'DELETE_NOT_ALLOWED');
      }

      return responseError(res, 'Internal server error', 500, 'SERVER_ERROR');
    }
  }

  async updateNegotiationStatus(req, res) {
    try {
      const { nego_id } = req.params;
      const { status } = req.body;  // 'Accepted' atau 'Rejected'
      const userId = req.user.id;
      const userType = req.user.type;

      // Validasi input status
      if (!status || !['Accepted', 'Rejected'].includes(status)) {
        return responseError(res, 'Status harus Accepted atau Rejected', 400, 'INVALID_STATUS');
      }

      // Get negotiation
      const nego = await negotiatingService.getNegotiationById(nego_id);
      if (!nego) {
        return responseError(res, 'Negotiation tidak ditemukan', 404, 'NEGO_NOT_FOUND');
      }

      // Validasi ekstra: Jangan proses kalau negosiasi sudah pernah di-accept/reject
      if (nego.status !== 'Pending') {
        return responseError(res, 'Tawaran ini sudah diproses sebelumnya', 400, 'ALREADY_PROCESSED');
      }

      // Get bid & project untuk RBAC
      const bid = await negotiatingService.getBidDetails(nego.bid_id);
      const project = await negotiatingService.getProjectDetails(bid.proyek_id);

      // --- TANTANGAN 1: RBAC & Mencegah "Jeruk Makan Jeruk" ---
      if (userType === 'mitra') {
        // Cek kepemilikan proyek
        if (String(project.mitra_id) !== String(userId)) {
          return responseError(res, 'Unauthorized untuk proyek ini', 403, 'FORBIDDEN');
        }
        // Pastikan Mitra hanya menjawab tawaran dari Kelompok
        if (nego.role_ === 'Mitra') {
          return responseError(res, 'Anda tidak bisa merespons tawaran Anda sendiri', 403, 'FORBIDDEN');
        }
      } else if (userType === 'talent') {
        // Cek kepemilikan bid
        if (String(bid.kelompok_id) !== String(userId)) {
          return responseError(res, 'Unauthorized untuk bid ini', 403, 'FORBIDDEN');
        }
        // Pastikan Talent hanya menjawab tawaran dari Mitra
        if (nego.role_ === 'Kelompok') {
          return responseError(res, 'Anda tidak bisa merespons tawaran Anda sendiri', 403, 'FORBIDDEN');
        }
      }

      // Update negotiation status di tabel negosiasi
      const updatedNego = await negotiatingService.updateNegotiationStatus(nego_id, status);

      // --- TANTANGAN 2: Sinkronisasi Harga saat Deal ---
      if (status === 'Accepted') {
        // Update bid jadi Accepted DAN bawa harga serta waktu yang disepakati
        await negotiatingService.updateBidStatusFinal(
          bid.bid_id, 
          'Accepted', 
          nego.response_harga, 
          nego.response_waktu
        );
        
        // Trigger notification ke pihak lawan
        const targetId = userType === 'mitra' ? bid.kelompok_id : project.mitra_id;
        await notificationService.sendDealConfirmed(targetId, project.judul_proyek);

        // 👈 PERUBAHAN 2: TRIGGER TRACKER (Kelompok 4)
        const dealData = {
          deal_id: `DEAL-${bid.proyek_id}-${bid.kelompok_id}`,
          project_id: bid.proyek_id,
          project_title: project.judul_proyek,
          mitra_id: project.mitra_id,
          group_id: bid.kelompok_id,
          bid_amount: bid.tawaran_harga,       // Harga histori awal
          deal_amount: nego.response_harga,    // Harga final hasil negosiasi
          status: 'Accepted',
          timeline: {
            bid_created_at: bid.waktu_bid,
            bid_accepted_at: new Date().toISOString(),
            estimated_completion: nego.response_waktu // Waktu final hasil negosiasi
          }
        };

        // Lempar datanya ke Kelompok 4
        await trackerService.sendDealToTracker(dealData);
      } 
      else if (status === 'Rejected') {
        // Sesuai flow, jika ditolak maka bid tersebut gagal (gugur)
        await negotiatingService.updateBidStatusFinal(bid.bid_id, 'Rejected');
      }

      return responseSuccess(res, `Negotiation berhasil di-${status.toLowerCase()}`, {
        nego_id: updatedNego.nego_id,
        status: updatedNego.status,
        bid_id: bid.bid_id,
        finalized: true
      }, 200);

    } catch (error) {
      console.error('Error in updateNegotiationStatus:', error);
      return responseError(res, error.message, 500, 'SERVER_ERROR');
    }
  }
}

module.exports = new NegotiatingController();
