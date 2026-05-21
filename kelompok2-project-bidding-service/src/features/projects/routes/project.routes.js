const express = require('express')
const projectController = require('../controllers/project.controller')
const authMiddleware = require('../../../middleware/auth.middleware')

const router = express.Router()

// GET routes — public (browsing projects)
router.get('/', projectController.getProjects)
router.get('/:id', projectController.getProjectById)

// Mutating routes — require auth
router.post('/', authMiddleware, projectController.createProject)
router.put('/:id', authMiddleware, projectController.updateProject)
router.delete('/:id', authMiddleware, projectController.deleteProject)

module.exports = router
