const biddingService = require('../services/bidding.service');

class BiddingController {
  async createBid(req, res) {
    try {
      const {
        group_id,
        project_id,
        priority,
        document_url,
        student_id,
        tawaran_harga,
        tawaran_waktu
      } = req.body;
      const resolvedStudentId = student_id || req.user.id;

      // Validation: Check required fields
      if (!group_id || !project_id || !priority || !document_url || !resolvedStudentId || !tawaran_harga || !tawaran_waktu) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: group_id, project_id, priority, document_url, tawaran_harga, tawaran_waktu',
          code: 'VALIDATION_ERROR'
        });
      }

      // Validation: Priority must be positive integer
      if (!Number.isInteger(priority) || priority < 1) {
        return res.status(400).json({
          success: false,
          message: 'Priority must be a positive integer',
          code: 'VALIDATION_ERROR'
        });
      }

      const offerAmount = Number(tawaran_harga);
      if (!Number.isFinite(offerAmount) || offerAmount < 0) {
        return res.status(400).json({
          success: false,
          message: 'tawaran_harga must be a positive number',
          code: 'VALIDATION_ERROR'
        });
      }

      const offerDate = new Date(tawaran_waktu);
      if (Number.isNaN(offerDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'tawaran_waktu must be a valid date',
          code: 'VALIDATION_ERROR'
        });
      }

      // Check if project exists
      const project = await biddingService.getProjectDetails(project_id);
      if (!project) {
        return res.status(400).json({
          success: false,
          message: 'Project not found',
          code: 'PROJECT_NOT_FOUND'
        });
      }

      // Check if project is closed
      if (project.status_proyek === 'Closed') {
        return res.status(400).json({
          success: false,
          message: 'Project is closed for bidding',
          code: 'PROJECT_CLOSED'
        });
      }

      // Check if group exists
      const group = await biddingService.getGroupDetails(group_id);
      if (!group) {
        return res.status(400).json({
          success: false,
          message: 'Group not found',
          code: 'GROUP_NOT_FOUND'
        });
      }

      // Check if student/pendaftar exists
      const student = await biddingService.getStudentDetails(resolvedStudentId);
      if (!student) {
        return res.status(400).json({
          success: false,
          message: 'Student not found',
          code: 'STUDENT_NOT_FOUND'
        });
      }

      // Check if group already bid on this project (uniqueness constraint)
      const existingBid = await biddingService.checkExistingBid(project_id, group_id);
      if (existingBid) {
        return res.status(409).json({
          success: false,
          message: 'Group has already bid on this project',
          code: 'DUPLICATE_BID'
        });
      }

      // Create bid with market maker logic
      const bidData = {
        projectId: project_id,
        groupId: group_id,
        studentId: resolvedStudentId,
        priority: priority,
        documentUrl: document_url,
        tawaranHarga: offerAmount,
        tawaranWaktu: tawaran_waktu
      };

      const newBid = await biddingService.createBid(bidData);

      // Update project status if quota reached
      await biddingService.updateProjectStatusIfFull(project_id);

      // Success response
      return res.status(201).json({
        success: true,
        message: newBid.status_bid === 'Rejected' 
          ? 'Bid rejected: project quota full' 
          : 'Bid created successfully',
        data: {
          bid_id: newBid.bid_id,
          group_id: newBid.kelompok_id,
          project_id: newBid.proyek_id,
          status: newBid.status_bid,
          priority: newBid.urutan_prioritas,
          tawaran_harga: newBid.tawaran_harga,
          tawaran_waktu: newBid.tawaran_waktu,
          created_at: newBid.waktu_bid
        }
      });

    } catch (error) {
      console.error('Error in createBid:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'SERVER_ERROR',
        error: error.message
      });
    }
  }
}

module.exports = new BiddingController();
