const prisma = require("../core/prisma");

function createLogbook(payload) {
  return prisma.logbook.create({
    data: {
      teamId: payload.teamId,
      authorId: payload.authorId,
      sprintNumber: payload.sprintNumber ?? null,
      status: payload.status,
      description: payload.description,
      blockers: payload.blockers ?? null,
    },
  });
}

function listLogbooksByTeam(teamId) {
  return prisma.logbook.findMany({
    where: { teamId },
    orderBy: { createdAt: "asc" },
  });
}

function getLatestLogbookByTeam(teamId) {
  // Logbook terbaru = createdAt paling besar.
  return prisma.logbook.findFirst({
    where: { teamId },
    orderBy: { createdAt: "desc" },
  });
}

module.exports = {
  createLogbook,
  listLogbooksByTeam,
  getLatestLogbookByTeam,
};
