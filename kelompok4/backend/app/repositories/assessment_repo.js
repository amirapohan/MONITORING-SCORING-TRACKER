const prisma = require("../core/prisma");

function createAssessment(payload) {
  return prisma.assessment.create({
    data: {
      teamId: payload.teamId,
      graderId: payload.graderId,
      scoreArchitecture: payload.scoreArchitecture ?? null,
      scoreImplementation: payload.scoreImplementation ?? null,
      scoreDocumentation: payload.scoreDocumentation ?? null,
      scorePresentation: payload.scorePresentation ?? null,
      finalScore: payload.finalScore,
      notes: payload.notes ?? null,
      walletAddress: payload.walletAddress ?? null,
    },
  });
}

function getAssessmentById(id) {
  return prisma.assessment.findUnique({ where: { id } });
}

function listAssessmentsByTeam(teamId) {
  return prisma.assessment.findMany({
    where: { teamId },
    orderBy: { createdAt: "asc" },
  });
}

async function lockAssessment(id) {
  const existing = await prisma.assessment.findUnique({ where: { id } });

  if (!existing) {
    return null;
  }

  return prisma.assessment.update({
    where: { id },
    data: { isLocked: true },
  });
}

module.exports = {
  createAssessment,
  getAssessmentById,
  listAssessmentsByTeam,
  lockAssessment,
};
