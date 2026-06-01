const projectDirectory = require("./project_directory");
const {
  ApiError,
  forbiddenError,
  notFoundError,
  validationError,
} = require("./api_error");

const allowedActorRoles = ["client", "talent"];

function requireString(value, fieldName) {
  if (!value || typeof value !== "string" || !value.trim()) {
    throw validationError(`Field '${fieldName}' is required`);
  }
}

function normalizeActorId(value, fieldName = "actorId") {
  requireString(value, fieldName);
  return value.trim();
}

function normalizeActorRole(value, fieldName = "actorRole") {
  requireString(value, fieldName);

  const normalizedRole = value.trim();

  if (!allowedActorRoles.includes(normalizedRole)) {
    throw validationError("Field 'actorRole' must be one of: client, talent");
  }

  return normalizedRole;
}

async function getProjectAssignment(projectId) {
  requireString(projectId, "projectId");

  try {
    const project = await projectDirectory.getProjectById(projectId.trim());

    if (!project) {
      throw notFoundError(`Field 'projectId' ('${projectId}') was not found in the bidding service`);
    }

    return {
      projectId: String(project.id),
      clientId: project.clientId ? String(project.clientId) : null,
      status: project.status ?? null,
      acceptedTalentIds: Array.isArray(project.acceptedTalentIds)
        ? project.acceptedTalentIds.map((value) => String(value))
        : [],
    };
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }

    throw new ApiError(
      502,
      "INTEGRATION_ERROR",
      `Unable to validate project '${projectId}' against the bidding service`,
    );
  }
}

async function assertProjectClientAccess({ projectId, actorId }) {
  const normalizedActorId = normalizeActorId(actorId);
  const project = await getProjectAssignment(projectId);

  if (!project.clientId || project.clientId !== normalizedActorId) {
    throw forbiddenError("Only the assigned project client can access this project resource");
  }

  return project;
}

async function assertProjectTalentAccess({ projectId, actorId }) {
  const normalizedActorId = normalizeActorId(actorId);
  const project = await getProjectAssignment(projectId);

  if (!project.acceptedTalentIds.includes(normalizedActorId)) {
    throw forbiddenError("Only an awarded talent can access this project resource");
  }

  return project;
}

async function assertProjectReadAccess({ projectId, actorId, actorRole }) {
  const normalizedActorRole = normalizeActorRole(actorRole);

  if (normalizedActorRole === "client") {
    return assertProjectClientAccess({ projectId, actorId });
  }

  return assertProjectTalentAccess({ projectId, actorId });
}

async function assertProjectMilestoneAccess({ projectId, employerId, studentId, actorId }) {
  const normalizedActorId = normalizeActorId(actorId);
  requireString(employerId, "employerId");
  requireString(studentId, "studentId");

  const project = await assertProjectClientAccess({ projectId, actorId: normalizedActorId });

  if (employerId.trim() !== normalizedActorId) {
    throw forbiddenError("Field 'actorId' must match the milestone employerId");
  }

  if (project.clientId !== employerId.trim()) {
    throw forbiddenError("Field 'employerId' must match the project clientId");
  }

  if (!project.acceptedTalentIds.includes(studentId.trim())) {
    throw forbiddenError("Field 'studentId' must reference an awarded talent on the project");
  }

  return project;
}

async function assertProjectSubmissionAccess({ projectId, studentId, actorId }) {
  const normalizedActorId = normalizeActorId(actorId);
  requireString(studentId, "studentId");

  if (studentId.trim() !== normalizedActorId) {
    throw forbiddenError("Field 'actorId' must match the submission studentId");
  }

  const project = await assertProjectTalentAccess({ projectId, actorId: normalizedActorId });

  if (!project.acceptedTalentIds.includes(studentId.trim())) {
    throw forbiddenError("Field 'studentId' must reference an awarded talent on the project");
  }

  return project;
}

module.exports = {
  getProjectAssignment,
  normalizeActorId,
  normalizeActorRole,
  assertProjectClientAccess,
  assertProjectTalentAccess,
  assertProjectReadAccess,
  assertProjectMilestoneAccess,
  assertProjectSubmissionAccess,
};
