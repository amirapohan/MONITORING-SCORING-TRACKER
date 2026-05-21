const projectService = require('../services/project.service')

const isProjectOwner = (project, userId) => (
  String(project.mitra_id) === String(userId)
)

const sendErrorResponse = (res, error) => {
  if (error.statusCode === 400) {
    return res.status(400).json({
      message: error.message,
      errors: error.errors || []
    })
  }

  if (error.statusCode === 404) {
    return res.status(404).json({
      message: error.message
    })
  }

  if (error.code === '23503') {
    return res.status(409).json({
      message: 'Project data conflicts with existing records'
    })
  }

  console.error(error)

  return res.status(500).json({
    message: 'Internal server error'
  })
}

const createProject = async (req, res) => {
  try {
    // RBAC Lapis 1: Hanya role 'client' yang boleh membuat proyek
    if (req.user.type !== 'client') {
      return res.status(403).json({ message: 'Forbidden: Hanya client yang dapat membuat proyek' })
    }

    // SECURITY PATCH: Paksa mitra_id menggunakan ID dari auth client
    // Jangan pernah percaya mitra_id dari input user (req.body)
    const payload = {
      ...req.body,
      mitra_id: req.user.id 
    }
    
    // AUTO-INSERT MITRA to satisfy foreign key constraint
    // Kelompok 2 previously expected mitra to be pre-seeded, but with Identity integration we must auto-seed
    await projectService.ensureMitraExists(req.user.id, req.user.name || 'Unknown Client', req.user.email || 'unknown@client.com');

    const project = await projectService.createProject(payload)

    return res.status(201).json({
      message: 'Project created successfully',
      data: project
    })
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

const getProjects = async (req, res) => {
  try {
    // 1. Ambil query parameter
    const { status, mitra_id, search, budget_min, budget_max } = req.query;

    // 2. Buat objek filter dan lakukan parsing tipe data yang aman
    const filters = {
      search: typeof search === 'string' ? search.trim() : undefined,
      status_proyek: typeof status === 'string' ? status.trim() : undefined,
      
      // Pastikan ID dan Budget di-convert menjadi angka (atau null/undefined jika kosong)
      mitra_id: mitra_id ? Number(mitra_id) : undefined,
      budget_min: budget_min ? Number(budget_min) : undefined,
      budget_max: budget_max ? Number(budget_max) : undefined
    };

    // 3. Validasi dasar: Jika user memasukkan sesuatu yang bukan angka pada field numerik
    if (
      (mitra_id && isNaN(filters.mitra_id)) ||
      (budget_min && isNaN(filters.budget_min)) ||
      (budget_max && isNaN(filters.budget_max))
    ) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: ['mitra_id, budget_min, and budget_max must be valid numbers']
      });
    }

    // 4. Jalankan service dengan filter yang sudah bersih
    const projects = await projectService.getProjects(filters);

    return res.status(200).json({
      message: 'Projects retrieved successfully',
      data: projects
    });
  } catch (error) {
    return sendErrorResponse(res, error);
  }
};

const getProjectById = async (req, res) => {
  try {
    const project = await projectService.getProjectById(req.params.id)

    return res.status(200).json({
      message: 'Project retrieved successfully',
      data: project
    })
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

const updateProject = async (req, res) => {
  try {
    // RBAC Lapis 1: Cek tipe user
    if (!['client', 'admin'].includes(req.user.type)) {
      return res.status(403).json({ message: 'Forbidden: Hanya client atau admin yang dapat mengupdate proyek' })
    }

    // Dapatkan data proyek saat ini untuk mengecek kepemilikan
    const currentProject = await projectService.getProjectById(req.params.id)

    // RBAC Lapis 2: Cek apakah client ini adalah pemilik sah dari proyek tersebut
    if (req.user.type === 'client' && !isProjectOwner(currentProject, req.user.id)) {
      return res.status(403).json({ message: 'Forbidden: Anda tidak memiliki akses untuk mengubah proyek ini' })
    }

    const project = await projectService.updateProject(req.params.id, req.body)

    return res.status(200).json({
      message: 'Project updated successfully',
      data: project
    })
  } catch (error) {
    // Tangani error jika getProjectById tidak menemukan data (404)
    return sendErrorResponse(res, error)
  }
}

const deleteProject = async (req, res) => {
  try {
    // RBAC Lapis 1: Cek tipe user
    if (!['client', 'admin'].includes(req.user.type)) {
      return res.status(403).json({ message: 'Forbidden: Hanya client atau admin yang dapat menghapus proyek' })
    }

    // Dapatkan data proyek saat ini untuk mengecek kepemilikan
    const currentProject = await projectService.getProjectById(req.params.id)

    // RBAC Lapis 2: Cek kepemilikan
    if (req.user.type === 'client' && !isProjectOwner(currentProject, req.user.id)) {
      return res.status(403).json({ message: 'Forbidden: Anda tidak memiliki akses untuk menghapus proyek ini' })
    }

    const project = await projectService.deleteProject(req.params.id)

    return res.status(200).json({
      message: 'Project deleted successfully',
      data: project
    })
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

module.exports = {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject
}
