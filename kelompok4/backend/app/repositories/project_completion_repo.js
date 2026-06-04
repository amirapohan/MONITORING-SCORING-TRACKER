const prisma = require("../core/prisma");

function mapProjectCompletion(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    projectId: row.projectId,
    projectTitle: row.projectTitle,
    clientId: row.clientId,
    actorId: row.actorId,
    status: row.status,
    completedAt: row.completedAt,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function createProjectCompletion(payload) {
  const row = await prisma.projectCompletion.create({
    data: {
      projectId: payload.projectId,
      projectTitle: payload.projectTitle,
      clientId: payload.clientId,
      actorId: payload.actorId,
      status: payload.status || "completed",
      completedAt: payload.completedAt ? new Date(payload.completedAt) : undefined,
      notes: payload.notes ?? null,
    },
  });

  return mapProjectCompletion(row);
}

async function getProjectCompletionByProjectId(projectId) {
  const row = await prisma.projectCompletion.findUnique({
    where: { projectId },
  });

  return mapProjectCompletion(row);
}

module.exports = {
  createProjectCompletion,
  getProjectCompletionByProjectId,
  mapProjectCompletion,
};
