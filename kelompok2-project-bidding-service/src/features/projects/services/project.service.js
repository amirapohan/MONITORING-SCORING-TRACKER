const projectRepository = require('../repositories/project.repository')
const {
  VALID_PROJECT_STATUSES,
  VALID_PROJECT_SKILLS
} = require('../../../middleware/projectsValidation')
const cache = require('../../../config/redis')

const createError = (message, statusCode, errors) => {
  const error = new Error(message)
  error.statusCode = statusCode

  if (errors) {
    error.errors = errors
  }

  return error
}

const createValidationError = (errors) => (
  createError('Validation failed', 400, errors)
)

const createNotFoundError = () => (
  createError('Project not found', 404)
)

const parsePositiveInteger = (value, fieldName, errors) => {
  if (typeof value !== 'number' && typeof value !== 'string') {
    errors.push(`${fieldName} must be a positive integer`)
    return null
  }

  const numberValue = Number(value)

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    errors.push(`${fieldName} must be a positive integer`)
    return null
  }

  return numberValue
}

const getRequiredString = (payload, fieldName, errors) => {
  const value = payload[fieldName]

  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(`${fieldName} is required`)
    return null
  }

  return value.trim()
}

const getRequiredSkills = (payload, fieldName, errors) => {
  const value = payload[fieldName]

  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${fieldName} must be a non-empty array`)
    return null
  }

  const normalizedSkills = value
    .filter((skill) => typeof skill === 'string')
    .map((skill) => skill.trim())
    .filter((skill) => skill !== '')

  if (normalizedSkills.length !== value.length) {
    errors.push(`${fieldName} must contain only non-empty strings`)
    return null
  }

  const uniqueSkills = [...new Set(normalizedSkills)]
  const invalidSkills = uniqueSkills.filter((skill) => !VALID_PROJECT_SKILLS.includes(skill))

  if (invalidSkills.length > 0) {
    errors.push(`${fieldName} must be one or more of: ${VALID_PROJECT_SKILLS.join(', ')}`)
    return null
  }

  return uniqueSkills
}

const getOptionalPositiveInteger = (payload, fieldName, errors) => {
  if (payload[fieldName] === undefined || payload[fieldName] === null) {
    return undefined
  }

  return parsePositiveInteger(payload[fieldName], fieldName, errors)
}

const getOptionalStatus = (payload, fieldName, errors) => {
  if (payload[fieldName] === undefined || payload[fieldName] === null) {
    return undefined
  }

  if (typeof payload[fieldName] !== 'string') {
    errors.push(`${fieldName} must be one of: ${VALID_PROJECT_STATUSES.join(', ')}`)
    return undefined
  }

  const status = payload[fieldName].trim()

  if (!VALID_PROJECT_STATUSES.includes(status)) {
    errors.push(`${fieldName} must be one of: ${VALID_PROJECT_STATUSES.join(', ')}`)
    return undefined
  }

  return status
}

const validateProjectId = (id) => {
  const errors = []
  const projectId = parsePositiveInteger(id, 'id', errors)

  if (errors.length > 0) {
    throw createValidationError(errors)
  }

  return projectId
}

const normalizeCreatePayload = (payload) => {
  const errors = []
  const projectPayload = payload || {}

  const mitraId = projectPayload.mitra_id === undefined || projectPayload.mitra_id === null
    ? null
    : getRequiredString(projectPayload, 'mitra_id', errors)

  if (projectPayload.mitra_id === undefined || projectPayload.mitra_id === null) {
    errors.push('mitra_id is required')
  }

  const judulProyek = getRequiredString(projectPayload, 'judul_proyek', errors)
  const deskripsiProyek = getRequiredString(projectPayload, 'deskripsi_proyek', errors)
  const skills = getRequiredSkills(projectPayload, 'skills', errors)
  const requirements = getRequiredString(projectPayload, 'requirements', errors)
  const kuotaMaksimal = getOptionalPositiveInteger(projectPayload, 'kuota_maksimal', errors)
  const statusProyek = getOptionalStatus(projectPayload, 'status_proyek', errors)

  if (projectPayload.budget_awal === undefined || projectPayload.budget_awal === null) {
    errors.push('budget_awal is required')
  }
  const budgetAwal = projectPayload.budget_awal

  if (errors.length > 0) {
    throw createValidationError(errors)
  }

  return {
    mitra_id: mitraId,
    judul_proyek: judulProyek,
    deskripsi_proyek: deskripsiProyek,
    skills,
    requirements,
    kuota_maksimal: kuotaMaksimal || 1,
    status_proyek: statusProyek || 'Open',
    budget_awal: budgetAwal
  }
}

const normalizeUpdatePayload = (payload, currentProject) => {
  const errors = []
  const projectPayload = payload || {}

  if (Object.keys(projectPayload).length === 0) {
    errors.push('request body cannot be empty')
  }

  if (projectPayload.proyek_id !== undefined) {
    errors.push('proyek_id cannot be updated')
  }

  if (projectPayload.mitra_id !== undefined) {
    errors.push('mitra_id cannot be updated')
  }

  const judulProyek = getRequiredString(projectPayload, 'judul_proyek', errors)
  const deskripsiProyek = getRequiredString(projectPayload, 'deskripsi_proyek', errors)
  const skills = getRequiredSkills(projectPayload, 'skills', errors)
  const requirements = getRequiredString(projectPayload, 'requirements', errors)
  const kuotaMaksimal = getOptionalPositiveInteger(projectPayload, 'kuota_maksimal', errors)
  const statusProyek = getOptionalStatus(projectPayload, 'status_proyek', errors)

  const budgetAwal = projectPayload.budget_awal !== undefined 
    ? projectPayload.budget_awal 
    : currentProject.budget_awal
  
  if (errors.length > 0) {
    throw createValidationError(errors)
  }

  return {
    judul_proyek: judulProyek,
    deskripsi_proyek: deskripsiProyek,
    skills,
    requirements,
    kuota_maksimal: kuotaMaksimal || currentProject.kuota_maksimal,
    status_proyek: statusProyek || currentProject.status_proyek,
    budget_awal: budgetAwal
  }
}

const ensureMitraExists = async (mitraId, namaMitra, kontakMitra) => {
  return projectRepository.ensureMitraExists(mitraId, namaMitra, kontakMitra)
}

const createProject = async (payload) => {
  const projectData = normalizeCreatePayload(payload)

  return projectRepository.create(projectData)
}

const getProjects = async (queryFilters = {}) => {
  const projects = await projectRepository.findAll(queryFilters)

  if (queryFilters.search && projects.length === 0) {
    throw createValidationError(['No projects found for search query'])
  }

  return projects
}

const getProjectById = async (id) => {
  const projectId = validateProjectId(id)
  const project = await projectRepository.findById(projectId)

  if (!project) {
    throw createNotFoundError()
  }

  return project
}

const updateProject = async (id, payload) => {
  const projectId = validateProjectId(id)
  const currentProject = await projectRepository.findById(projectId)

  if (!currentProject) {
    throw createNotFoundError()
  }

  const projectData = normalizeUpdatePayload(payload, currentProject)

  return projectRepository.update(projectId, projectData)
}

const deleteProject = async (id) => {
  const projectId = validateProjectId(id)
  const deletedProject = await projectRepository.remove(projectId)

  if (!deletedProject) {
    throw createNotFoundError()
  }

  return deletedProject
}

const getPopularProjects = async (limit = 10) => {
  const cacheKey = `projects:popular:limit:${limit}`
  const TTL = 300 // 5 minutes

  const cachedData = await cache.getJson(cacheKey)
  if (cachedData) {
    return { data: cachedData, source: 'cache' }
  }

  const projects = await projectRepository.findPopular(limit)

  await cache.setJson(cacheKey, projects, TTL)

  return { data: projects, source: 'repository' }
}

module.exports = {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  ensureMitraExists,
  getPopularProjects
}
