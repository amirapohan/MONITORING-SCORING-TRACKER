const express = require('express')
const projectController = require('../controllers/project.controller')
const authMiddleware = require('../../../middleware/auth.middleware')
const db = require('../../../config/db')

const router = express.Router()

router.get('/fix-db', async (req, res) => {
  try {
    await db.query(`
      ALTER TABLE proyek DROP CONSTRAINT IF EXISTS fk_mitra;
      ALTER TABLE mitra ALTER COLUMN mitra_id DROP DEFAULT;
      ALTER TABLE mitra ALTER COLUMN mitra_id TYPE VARCHAR(50);
      ALTER TABLE proyek ALTER COLUMN mitra_id TYPE VARCHAR(50);
      ALTER TABLE proyek ADD CONSTRAINT fk_mitra FOREIGN KEY (mitra_id) REFERENCES mitra(mitra_id) ON DELETE CASCADE;
    `);
    res.json({ message: 'DB Fixed Successfully!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', projectController.getProjects)
router.get('/:id', projectController.getProjectById)
router.post('/', authMiddleware, projectController.createProject)
router.put('/:id', authMiddleware, projectController.updateProject)
router.delete('/:id', authMiddleware, projectController.deleteProject)

module.exports = router
