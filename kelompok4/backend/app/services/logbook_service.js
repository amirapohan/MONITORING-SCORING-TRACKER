const logbookRepository = require("../repositories/logbook_repo");
const { notFoundError, validationError } = require("../core/api_error");

function requireString(value, fieldName) {
  if (!value || typeof value !== "string" || !value.trim()) {
    throw validationError(`Field '${fieldName}' is required`);
  }
}

function createLogbook(payload = {}) {
  requireString(payload.teamId, "teamId");
  requireString(payload.authorId, "authorId");
  requireString(payload.status, "status");
  requireString(payload.description, "description");

  if (
    payload.sprintNumber !== undefined &&
    payload.sprintNumber !== null &&
    (typeof payload.sprintNumber !== "number" || payload.sprintNumber <= 0)
  ) {
    throw validationError("Field 'sprintNumber' must be a positive number");
  }

  if (!["in_progress", "blocked", "completed"].includes(payload.status)) {
    throw validationError(
      "Field 'status' must be one of: in_progress, blocked, completed",
    );
  }

  return logbookRepository.createLogbook({
    teamId: payload.teamId.trim(),
    authorId: payload.authorId.trim(),
    sprintNumber: payload.sprintNumber,
    status: payload.status.trim(),
    description: payload.description.trim(),
    blockers: typeof payload.blockers === "string" ? payload.blockers.trim() : null,
  });
}

function listLogbooksByTeam(teamId) {
  requireString(teamId, "teamId");
  return logbookRepository.listLogbooksByTeam(teamId.trim());
}

async function getLatestLogbookByTeam(teamId) {
  requireString(teamId, "teamId");

  const latestLogbook = await logbookRepository.getLatestLogbookByTeam(teamId.trim());

  if (!latestLogbook) {
    throw notFoundError(`No logbook entries found for team '${teamId}'`);
  }

  return latestLogbook;
}

module.exports = {
  createLogbook,
  listLogbooksByTeam,
  getLatestLogbookByTeam,
};
