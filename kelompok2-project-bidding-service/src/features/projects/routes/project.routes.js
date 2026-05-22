const express = require('express')
const projectController = require('../controllers/project.controller')
const authMiddleware = require('../../../middleware/auth.middleware')

const router = express.Router()

router.get('/', projectController.getProjects)
router.get('/:id', projectController.getProjectById)
router.post('/', authMiddleware, projectController.createProject)
router.put('/:id', authMiddleware, projectController.updateProject)
router.delete('/:id', authMiddleware, projectController.deleteProject)

module.exports = router

