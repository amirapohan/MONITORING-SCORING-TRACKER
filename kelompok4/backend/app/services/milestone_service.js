const milestoneRepository = require("../repositories/milestone_repo");
const eventPublisher = require("./event_publisher");
const { getUserById } = require("../core/user_directory");
const projectDirectory = require("../core/project_directory");
const { isIntegrationValidationEnabled } = require("../core/integration_config");
const {
  conflictError,
  notFoundError,
  validationError,
} = require("../core/api_error");

const allowedStatuses = ["open", "in_progress", "completed", "cancelled"];

function requireString(value, fieldName) {
  if (!value || typeof value !== "string" || !value.trim()) {
    throw validationError(`Field '${fieldName}' is required`);
  }
}

function normalizeOptionalString(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw validationError("Field 'description' must be a string");
  }

  return value.trim() ? value.trim() : null;
}

function parsePositivePaymentAmount(value) {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    throw validationError("Field 'paymentAmount' must be a positive number");
  }

  return value;
}

function parseFutureDeadline(value, fieldName = "deadline") {
  requireString(value, fieldName);

  const parsedDate = new Date(value.trim());

  if (Number.isNaN(parsedDate.getTime())) {
    throw validationError(`Field '${fieldName}' must be a valid datetime`);
  }

  if (parsedDate.getTime() <= Date.now()) {
    throw validationError(`Field '${fieldName}' must be in the future`);
  }

  return parsedDate.toISOString();
}

function normalizeStatus(value) {
  if (value === undefined) {
    return undefined;
  }

  requireString(value, "status");
  const normalizedStatus = value.trim();

  if (!allowedStatuses.includes(normalizedStatus)) {
    throw validationError(
      "Field 'status' must be one of: open, in_progress, completed, cancelled",
    );
  }

  return normalizedStatus;
}

async function getMilestoneById(id) {
  requireString(id, "id");

  const milestone = await milestoneRepository.getMilestoneById(id.trim());

  if (!milestone) {
    throw notFoundError(`Milestone with id '${id}' was not found`);
  }

  return milestone;
}

// projectId boleh string atau number (proyek_id K2 = SERIAL int) -> simpan sbg string.
function normalizeOptionalProjectId(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  throw validationError("Field 'projectId' must be a string or number");
}

// Validasi lintas-service (hanya saat VALIDATE_INTEGRATION on).
async function assertUserHasRole(userId, expectedRole, fieldName) {
  const user = await getUserById(userId);

  if (!user) {
    throw notFoundError(
      `Field '${fieldName}' ('${userId}') was not found in the identity service`,
    );
  }

  if (expectedRole && user.role && user.role !== expectedRole) {
    throw validationError(
      `Field '${fieldName}' ('${userId}') must reference a '${expectedRole}' user (got '${user.role}')`,
    );
  }

  return user;
}

async function assertTalentAwardedOnProject(projectId, studentId) {
  const project = await projectDirectory.getProjectById(projectId);

  if (!project) {
    throw notFoundError(
      `Field 'projectId' ('${projectId}') was not found in the bidding service`,
    );
  }

  if (!project.acceptedTalentIds.includes(String(studentId))) {
    throw validationError(
      `Student '${studentId}' has no accepted bid on project '${projectId}'; a milestone can only be created for an awarded talent`,
    );
  }

  return project;
}

async function createMilestone(payload = {}) {
  requireString(payload.title, "title");
  requireString(payload.employerId, "employerId");
  requireString(payload.studentId, "studentId");

  const employerId = payload.employerId.trim();
  const studentId = payload.studentId.trim();
  const projectId = normalizeOptionalProjectId(payload.projectId);

  // Real-world rule (di balik flag): hanya client sah yang menetapkan milestone
  // untuk talent yang sudah di-accept (awarded) pada project terkait.
  if (isIntegrationValidationEnabled()) {
    await assertUserHasRole(employerId, "client", "employerId");
    await assertUserHasRole(studentId, "talent", "studentId");

    if (projectId) {
      await assertTalentAwardedOnProject(projectId, studentId);
    }
  }

  const milestone = await milestoneRepository.createMilestone({
    title: payload.title.trim(),
    paymentAmount: parsePositivePaymentAmount(payload.paymentAmount),
    description: normalizeOptionalString(payload.description) ?? null,
    deadline: parseFutureDeadline(payload.deadline),
    employerId,
    studentId,
    projectId,
    status: "open",
  });

  await eventPublisher.publishToEventLog("milestone_created", {
    milestoneId: milestone.id,
    employerId: milestone.employerId,
    studentId: milestone.studentId,
    projectId: milestone.projectId,
    status: milestone.status,
    deadline: milestone.deadline,
  });

  return milestone;
}

async function listMilestones(filters = {}) {
  const normalizedFilters = {};

  if (filters.employerId !== undefined) {
    requireString(filters.employerId, "employerId");
    normalizedFilters.employerId = filters.employerId.trim();
  }

  if (filters.studentId !== undefined) {
    requireString(filters.studentId, "studentId");
    normalizedFilters.studentId = filters.studentId.trim();
  }

  if (filters.projectId !== undefined) {
    const normalizedProjectId = normalizeOptionalProjectId(filters.projectId);
    if (normalizedProjectId) {
      normalizedFilters.projectId = normalizedProjectId;
    }
  }

  if (filters.status !== undefined) {
    normalizedFilters.status = normalizeStatus(filters.status);
  }

  return milestoneRepository.listMilestones(normalizedFilters);
}

async function updateMilestone(id, payload = {}) {
  const existingMilestone = await getMilestoneById(id);

  if (existingMilestone.status === "completed") {
    throw conflictError("Completed milestones cannot be edited");
  }

  const updatePayload = {};

  if (payload.title !== undefined) {
    requireString(payload.title, "title");
    updatePayload.title = payload.title.trim();
  }

  if (payload.paymentAmount !== undefined) {
    updatePayload.paymentAmount = parsePositivePaymentAmount(payload.paymentAmount);
  }

  if (payload.description !== undefined) {
    updatePayload.description = normalizeOptionalString(payload.description);
  }

  if (payload.deadline !== undefined) {
    updatePayload.deadline = parseFutureDeadline(payload.deadline);
  }

  if (payload.status !== undefined) {
    updatePayload.status = normalizeStatus(payload.status);
  }

  if (Object.keys(updatePayload).length === 0) {
    throw validationError("At least one editable milestone field is required");
  }

  const updatedMilestone = await milestoneRepository.updateMilestone(
    existingMilestone.id,
    updatePayload,
  );

  if (!updatedMilestone) {
    const latestMilestone = await getMilestoneById(existingMilestone.id);

    if (latestMilestone.status === "completed") {
      throw conflictError("Completed milestones cannot be edited");
    }

    throw notFoundError(`Milestone with id '${id}' was not found`);
  }

  await eventPublisher.publishToEventLog("milestone_updated", {
    milestoneId: updatedMilestone.id,
    employerId: updatedMilestone.employerId,
    studentId: updatedMilestone.studentId,
    status: updatedMilestone.status,
    deadline: updatedMilestone.deadline,
  });

  return updatedMilestone;
}

module.exports = {
  createMilestone,
  listMilestones,
  getMilestoneById,
  updateMilestone,
};
