const db = require('../../../config/db')

const create = async (projectData) => {
  const sql = `
    INSERT INTO proyek (
      mitra_id,
      judul_proyek,
      deskripsi_proyek,
      skills,
      requirements,
      kuota_maksimal,
      status_proyek,
      budget_awal
    )
    VALUES ($1, $2, $3, $4::project_skill_enum[], $5, $6, $7, $8)
    RETURNING *
  `

  const values = [
    projectData.mitra_id,
    projectData.judul_proyek,
    projectData.deskripsi_proyek,
    projectData.skills,
    projectData.requirements,
    projectData.kuota_maksimal,
    projectData.status_proyek,
    projectData.budget_awal
  ]

  const result = await db.query(sql, values)
  return result.rows[0]
}

const ensureMitraExists = async (mitraId, namaMitra, kontakMitra) => {
  const sql = `
    INSERT INTO mitra (mitra_id, nama_mitra, kontak_mitra)
    VALUES ($1, $2, $3)
    ON CONFLICT (mitra_id) DO NOTHING
  `
  await db.query(sql, [mitraId, namaMitra, kontakMitra])
}

const findAll = async () => {
  const sql = `
    SELECT *
    FROM proyek
    ORDER BY created_at DESC, proyek_id DESC
  `

  const result = await db.query(sql)
  return result.rows
}

const findById = async (id) => {
  const sql = `
    SELECT *
    FROM proyek
    WHERE proyek_id = $1
  `

  const result = await db.query(sql, [id])
  return result.rows[0]
}

const update = async (id, projectData) => {
  const sql = `
    UPDATE proyek
    SET
      judul_proyek = $1,
      deskripsi_proyek = $2,
      skills = $3::project_skill_enum[],
      requirements = $4,
      kuota_maksimal = $5,
      status_proyek = $6,
      budget_awal = $7
    WHERE proyek_id = $8
    RETURNING *
  `

  const values = [
    projectData.judul_proyek,
    projectData.deskripsi_proyek,
    projectData.skills,
    projectData.requirements,
    projectData.kuota_maksimal,
    projectData.status_proyek,
    projectData.budget_awal,
    id
  ]

  const result = await db.query(sql, values)
  return result.rows[0]
}

const remove = async (id) => {
  const sql = `
    DELETE FROM proyek
    WHERE proyek_id = $1
    RETURNING *
  `

  const result = await db.query(sql, [id])
  return result.rows[0]
}

module.exports = {
  create,
  findAll,
  findById,
  update,
  remove,
  ensureMitraExists
}
