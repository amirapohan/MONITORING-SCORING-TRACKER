const express = require('express')
const router = express.Router()
const biddingController = require('../controllers/bidding.controller')
const authMiddleware = require('../../../middleware/auth.middleware')
router.get('/', authMiddleware, biddingController.getBids)
router.get('/:id', authMiddleware, biddingController.getBidById)
router.post('/', authMiddleware, biddingController.createBid)
router.put('/:id/status', authMiddleware, biddingController.updateBidStatus)

module.exports = router
