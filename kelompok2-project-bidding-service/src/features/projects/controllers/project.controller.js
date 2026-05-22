const projectService = require('../services/project.service')
const notificationService = require('../../../utils/notification')

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
    message: 'Internal server error',
    debug_error: error.message,
    debug_stack: (error.stack || '').split('\n').slice(0, 3)
  })
}

const createProject = async (req, res) => {
  try {
    if (req.user.type !== 'client') {
      return res.status(403).json({ message: 'Forbidden: Hanya client yang dapat membuat proyek' })
    }

    const payload = {
      ...req.body,
      mitra_id: req.user.id 
    }
    
    await projectService.ensureMitraExists(req.user.id, req.user.name || 'Unknown Client', req.user.email || 'unknown@client.com');

    const project = await projectService.createProject(payload)
    await notificationService.sendProjectCreated(project, {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email
    })

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
    const { status, mitra_id, search, budget_min, budget_max } = req.query;

    const filters = {
      search: typeof search === 'string' ? search.trim() : undefined,
      status_proyek: typeof status === 'string' ? status.trim() : undefined,
      mitra_id: mitra_id ? Number(mitra_id) : undefined,
      budget_min: budget_min ? Number(budget_min) : undefined,
      budget_max: budget_max ? Number(budget_max) : undefined
    };

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
    if (!['client', 'admin'].includes(req.user.type)) {
      return res.status(403).json({ message: 'Forbidden: Hanya client atau admin yang dapat mengupdate proyek' })
    }

    const currentProject = await projectService.getProjectById(req.params.id)

    if (req.user.type === 'client' && !isProjectOwner(currentProject, req.user.id)) {
      return res.status(403).json({ message: 'Forbidden: Anda tidak memiliki akses untuk mengubah proyek ini' })
    }

    const project = await projectService.updateProject(req.params.id, req.body)

    return res.status(200).json({
      message: 'Project updated successfully',
      data: project
    })
  } catch (error) {
    return sendErrorResponse(res, error)
  }
}

const deleteProject = async (req, res) => {
  try {
    if (!['client', 'admin'].includes(req.user.type)) {
      return res.status(403).json({ message: 'Forbidden: Hanya client atau admin yang dapat menghapus proyek' })
    }

    const currentProject = await projectService.getProjectById(req.params.id)

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
