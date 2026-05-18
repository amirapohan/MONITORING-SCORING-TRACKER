const milestoneRepository = require("../repositories/milestone_repo");
const eventPublisher = require("./event_publisher");
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

async function createMilestone(payload = {}) {
  requireString(payload.title, "title");
  requireString(payload.employerId, "employerId");
  requireString(payload.studentId, "studentId");

  const milestone = await milestoneRepository.createMilestone({
    title: payload.title.trim(),
    paymentAmount: parsePositivePaymentAmount(payload.paymentAmount),
    description: normalizeOptionalString(payload.description) ?? null,
    deadline: parseFutureDeadline(payload.deadline),
    employerId: payload.employerId.trim(),
    studentId: payload.studentId.trim(),
    status: "open",
  });

  await eventPublisher.publishToEventLog("milestone_created", {
    milestoneId: milestone.id,
    employerId: milestone.employerId,
    studentId: milestone.studentId,
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
