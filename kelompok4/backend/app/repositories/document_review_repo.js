// Ported from raw `pg` pool to Prisma (DocumentReview model).
// Append-only: only create + read methods are exposed (no update/delete),
// replacing the SQL trigger that enforced append-only at the DB level.
const prisma = require("../core/prisma");

function mapDocumentReview(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    documentId: row.documentId,
    reviewerId: row.reviewerId,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt,
  };
}

async function createDocumentReview(payload) {
  const row = await prisma.documentReview.create({
    data: {
      documentId: payload.documentId,
      reviewerId: payload.reviewerId,
      status: payload.status,
      notes: payload.notes,
    },
  });

  return mapDocumentReview(row);
}

async function listReviewsByDocumentId(documentId) {
  const rows = await prisma.documentReview.findMany({
    where: { documentId },
    orderBy: { createdAt: "desc" },
  });

  return rows.map(mapDocumentReview);
}

async function getLatestReviewByDocumentId(documentId) {
  const row = await prisma.documentReview.findFirst({
    where: { documentId },
    orderBy: { createdAt: "desc" },
  });

  return mapDocumentReview(row);
}

module.exports = {
  createDocumentReview,
  listReviewsByDocumentId,
  getLatestReviewByDocumentId,
};
