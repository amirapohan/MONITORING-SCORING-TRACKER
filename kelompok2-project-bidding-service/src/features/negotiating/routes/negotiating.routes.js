const express = require('express')
const router = express.Router()
const negotiatingController = require('../controllers/negotiating.controller')
const authMiddleware = require('../../../middleware/auth.middleware')
router.get('/', authMiddleware, negotiatingController.getAllNegotiations)
router.get('/:bid_id', authMiddleware, negotiatingController.getNegotiationsByBidId)
router.post('/:bid_id', authMiddleware, negotiatingController.createNegotiation)
router.delete('/', authMiddleware, negotiatingController.deleteNegotiation)
router.put('/:nego_id/status', authMiddleware, negotiatingController.updateNegotiationStatus)

module.exports = router