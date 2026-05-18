const assessmentRepository = require("../repositories/assessment_repo");
const eventPublisher = require("./event_publisher");
const nftService = require("./nft_service");
const cache = require("../core/redis");
const { notFoundError, validationError } = require("../core/api_error");

const TEAM_CACHE_TTL_SECONDS = 60;
const teamCacheKey = (teamId) => `assessments:team:${teamId}`;

function requireString(value, fieldName) {
  if (!value || typeof value !== "string" || !value.trim()) {
    throw validationError(`Field '${fieldName}' is required`);
  }
}

async function createAssessment(payload = {}) {
  requireString(payload.teamId, "teamId");
  requireString(payload.graderId, "graderId");

  if (typeof payload.finalScore !== "number" || payload.finalScore < 0) {
    throw validationError("Field 'finalScore' must be a number greater than or equal to 0");
  }

  return assessmentRepository.createAssessment({
    teamId: payload.teamId.trim(),
    graderId: payload.graderId.trim(),
    scoreArchitecture: payload.scoreArchitecture,
    scoreImplementation: payload.scoreImplementation,
    scoreDocumentation: payload.scoreDocumentation,
    scorePresentation: payload.scorePresentation,
    finalScore: payload.finalScore,
    notes: typeof payload.notes === "string" ? payload.notes.trim() : null,
    walletAddress:
      typeof payload.walletAddress === "string" ? payload.walletAddress.trim() : null,
  });
}

async function listAssessmentsByTeam(teamId) {
  requireString(teamId, "teamId");
  const id = teamId.trim();
  const key = teamCacheKey(id);

  // 1. Coba dari cache dulu (cache-aside / lazy loading).
  const cached = await cache.getJson(key);
  if (cached) {
    return { data: cached, source: "cache" };
  }

  // 2. Cache miss -> ambil dari source of truth (PostgreSQL via Prisma).
  const data = await assessmentRepository.listAssessmentsByTeam(id);

  // 3. Isi cache untuk request berikutnya. TTL dipakai agar data tidak
  //    basi selamanya (cache otomatis kedaluwarsa setelah 60 detik).
  await cache.setJson(key, data, TEAM_CACHE_TTL_SECONDS);

  return { data, source: "repository" };
}

async function lockAssessment(id) {
  requireString(id, "id");

  const lockedAssessment = await assessmentRepository.lockAssessment(id.trim());

  if (!lockedAssessment) {
    throw notFoundError(`Assessment with id '${id}' was not found`);
  }

  const publishedEvent = eventPublisher.publish("nilai_final_dikunci", {
    assessmentId: lockedAssessment.id,
    teamId: lockedAssessment.teamId,
    finalScore: lockedAssessment.finalScore,
  });

  const nftRecord = await nftService.createMockNftFromAssessment(lockedAssessment);

  return {
    assessment: lockedAssessment,
    event: publishedEvent,
    nft: nftRecord,
  };
}

module.exports = {
  createAssessment,
  listAssessmentsByTeam,
  lockAssessment,
};
