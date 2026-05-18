// Ported from raw `pg` pool to Prisma (MilestoneSubmission /
// MilestoneSubmissionReview models). Return shapes and method signatures kept
// identical so milestone_submission_service.js works without modification.
//
// `getUserById` is delegated to the Identity & SSO service (users are not
// owned by this microservice) via the user_directory helper.
const prisma = require("../core/prisma");
const userDirectory = require("../core/user_directory");

function mapSubmission(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    milestoneId: row.milestoneId,
    studentId: row.studentId,
    description: row.description,
    fileUrl: row.fileUrl,
    fileName: row.fileName,
    fileType: row.fileType,
    fileSize: row.fileSize === null || row.fileSize === undefined ? null : Number(row.fileSize),
    fileHash: row.fileHash,
    links: row.links || [],
    status: row.status,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt,
    submittedAt: row.submittedAt,
    updatedAt: row.updatedAt,
  };
}

function mapSubmissionReview(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    submissionId: row.submissionId,
    reviewerId: row.reviewerId,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt,
  };
}

async function createSubmission(payload) {
  try {
    const row = await prisma.milestoneSubmission.create({
      data: {
        milestoneId: payload.milestoneId,
        studentId: payload.studentId,
        description: payload.description,
        fileUrl: payload.fileUrl,
        fileName: payload.fileName,
        fileType: payload.fileType,
        fileSize: payload.fileSize,
        fileHash: payload.fileHash,
        links: payload.links || [],
        status: payload.status || "submitted",
      },
    });

    return mapSubmission(row);
  } catch (error) {
    // Keep the service's PG-style duplicate detection working.
    if (error && error.code === "P2002") {
      error.code = "23505";
    }

    throw error;
  }
}

async function listSubmissions(filters = {}) {
  const where = {};

  if (filters.milestoneId) {
    where.milestoneId = filters.milestoneId;
  }

  if (filters.studentId) {
    where.studentId = filters.studentId;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  const rows = await prisma.milestoneSubmission.findMany({
    where,
    orderBy: { submittedAt: "desc" },
  });

  return rows.map(mapSubmission);
}

async function getSubmissionById(id) {
  const row = await prisma.milestoneSubmission.findUnique({
    where: { id },
  });

  return mapSubmission(row);
}

async function getSubmissionByMilestoneAndStudent(milestoneId, studentId) {
  const row = await prisma.milestoneSubmission.findFirst({
    where: { milestoneId, studentId },
    orderBy: { submittedAt: "desc" },
  });

  return mapSubmission(row);
}

async function createSubmissionReviewAndUpdateStatus(payload) {
  try {
    return await prisma.$transaction(async (tx) => {
      const review = await tx.milestoneSubmissionReview.create({
        data: {
          submissionId: payload.submissionId,
          reviewerId: payload.reviewerId,
          status: payload.status,
          notes: payload.notes,
        },
      });

      const isApproved = payload.status === "approved";

      // Mirror the raw-SQL guard: only transition when not already approved.
      const updated = await tx.milestoneSubmission.updateMany({
        where: { id: payload.submissionId, status: { not: "approved" } },
        data: {
          status: payload.status,
          approvedBy: isApproved ? payload.reviewerId : null,
          approvedAt: isApproved ? new Date() : null,
        },
      });

      if (updated.count === 0) {
        const rollback = new Error("submission already approved");
        rollback.__rollback = true;
        throw rollback;
      }

      const submission = await tx.milestoneSubmission.findUnique({
        where: { id: payload.submissionId },
      });

      return {
        review: mapSubmissionReview(review),
        submission: mapSubmission(submission),
      };
    });
  } catch (error) {
    if (error && error.__rollback) {
      return {
        review: null,
        submission: null,
      };
    }

    throw error;
  }
}

async function listReviewsBySubmissionId(submissionId) {
  const rows = await prisma.milestoneSubmissionReview.findMany({
    where: { submissionId },
    orderBy: { createdAt: "desc" },
  });

  return rows.map(mapSubmissionReview);
}

async function getLatestReviewBySubmissionId(submissionId) {
  const row = await prisma.milestoneSubmissionReview.findFirst({
    where: { submissionId },
    orderBy: { createdAt: "desc" },
  });

  return mapSubmissionReview(row);
}

async function getUserById(id) {
  return userDirectory.getUserById(id);
}

module.exports = {
  createSubmission,
  listSubmissions,
  getSubmissionById,
  getSubmissionByMilestoneAndStudent,
  createSubmissionReviewAndUpdateStatus,
  listReviewsBySubmissionId,
  getLatestReviewBySubmissionId,
  getUserById,
};
