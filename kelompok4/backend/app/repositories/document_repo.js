const prisma = require("../core/prisma");

function createDocument(payload) {
  return prisma.document.create({
    data: {
      teamId: payload.teamId,
      uploaderId: payload.uploaderId,
      fileUrl: payload.fileUrl,
      fileName: payload.fileName,
      fileType: payload.fileType,
      fileSize: payload.fileSize,
      fileHash: payload.fileHash,
      description: payload.description ?? null,
    },
  });
}

function listDocumentsByTeam(teamId) {
  return prisma.document.findMany({
    where: { teamId },
    orderBy: { createdAt: "asc" },
  });
}

function getDocumentById(id) {
  return prisma.document.findUnique({ where: { id } });
}

module.exports = {
  createDocument,
  listDocumentsByTeam,
  getDocumentById,
};
