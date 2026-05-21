const express = require('express')
const router = express.Router()
const biddingController = require('../controllers/bidding.controller')
const authMiddleware = require('../../../middleware/auth.middleware')

// GET all bids dengan role-based filtering (client, talent, atau admin)
// Memerlukan header: X-User-ID dan X-User-Type
router.get('/', authMiddleware, biddingController.getBids)

// GET bid by id (was placeholder, now implemented)
router.get('/:id', authMiddleware, biddingController.getBidById)

// POST create a new bid
router.post('/', authMiddleware, biddingController.createBid)

// PUT update bid status (e.g., Accept/Reject)
router.put('/:id/status', authMiddleware, biddingController.updateBidStatus)

module.exports = router
