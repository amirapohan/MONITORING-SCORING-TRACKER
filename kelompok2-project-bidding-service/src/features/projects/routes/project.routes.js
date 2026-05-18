const app= require('express')
const router= app.Router()

router.get('/:id', (req,res) => {
    const id = req.params.id
    res.send(`this is ${id} project`)
})

module.exports = router
