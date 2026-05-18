const express = require('express')
const router = express.Router()
const biddingController = require('../controllers/bidding.controller')

router.post('/', biddingController.createBid)

router.get('/:id', (req,res) => {
    const id = req.params.id
    res.send(`ini adalah bidding ${id}`)
})

module.exports = router