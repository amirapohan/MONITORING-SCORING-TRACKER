// Endpoint internal (service-to-service), dilindungi internal API key — bukan
// lewat gateway/JWT. Dipakai service lain untuk memvalidasi data project bidding.
const express = require('express')
const router = express.Router()
const db = require('../config/db')
const internalApiKeyMiddleware = require('../middleware/internalApiKey.middleware')

router.use(internalApiKeyMiddleware)

// GET /internal/projects/:id
// Dipakai K4 (Tracker) untuk: (a) memastikan project ada, dan (b) mengetahui
// talent mana yang sudah di-ACCEPT (awarded) pada project tsb — syarat sebelum
// sebuah milestone boleh dibuat untuk talent itu.
router.get('/projects/:id', async (req, res) => {
  const projectId = req.params.id

  // proyek_id adalah integer; id non-numerik pasti tidak ada -> 404 (hindari 500).
  if (!/^\d+$/.test(String(projectId))) {
    return res.status(404).json({
      success: false,
      message: `Project '${projectId}' not found`,
      code: 'PROJECT_NOT_FOUND'
    })
  }

  try {
    const projectResult = await db.query(
      'SELECT proyek_id, judul_proyek, mitra_id, status_proyek FROM proyek WHERE proyek_id = $1',
      [projectId]
    )

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Project '${projectId}' not found`,
        code: 'PROJECT_NOT_FOUND'
      })
    }

    const project = projectResult.rows[0]

    const acceptedResult = await db.query(
      "SELECT pendaftar_id FROM bid WHERE proyek_id = $1 AND status_bid = 'Accepted'",
      [projectId]
    )

    const acceptedTalentIds = acceptedResult.rows.map((row) => String(row.pendaftar_id))

    return res.status(200).json({
      success: true,
      data: {
        id: String(project.proyek_id),
        title: project.judul_proyek,
        clientId: project.mitra_id,
        status: project.status_proyek,
        acceptedTalentIds
      }
    })
  } catch (error) {
    console.error('[internal] GET /projects/:id error:', error)
    return res.status(500).json({
      success: false,
      message: 'Internal error resolving project',
      code: 'INTERNAL_ERROR',
      error: error.message
    })
  }
})

module.exports = router
