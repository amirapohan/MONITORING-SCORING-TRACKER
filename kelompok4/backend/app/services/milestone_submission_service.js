const crypto = require("crypto");
const milestoneRepository = require("../repositories/milestone_repo");
const submissionRepository = require("../repositories/milestone_submission_repo");
const eventPublisher = require("./event_publisher");
const documentStorageService = require("./document_storage_service");
const { getUserById } = require("../core/user_directory");
const { isIntegrationValidationEnabled } = require("../core/integration_config");
const {
  conflictError,
  forbiddenError,
  notFoundError,
  validationError,
} = require("../core/api_error");

const allowedStatuses = ["submitted", "approved", "rejected", "needs_revision"];
const allowedReviewStatuses = ["approved", "rejected", "needs_revision"];
const reviewStatusEventTypes = {
  approved: "submission_approved",
  rejected: "submission_rejected",
  needs_revision: "submission_needs_revision",
};

function requireString(value, fieldName) {
  if (!value || typeof value !== "string" || !value.trim()) {
    throw validationError(`Field '${fieldName}' is required`);
  }
}

function normalizeLinks(value) {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  const links = typeof value === "string" ? JSON.parse(value) : value;

  if (!Array.isArray(links)) {
    throw validationError("Field 'links' must be an array");
  }

  return links.map((link, index) => {
    if (typeof link === "string") {
      const trimmedUrl = link.trim();

      if (!trimmedUrl) {
        throw validationError(`Field 'links[${index}]' cannot be empty`);
      }

      return {
        url: trimmedUrl,
        label: null,
      };
    }

    if (!link || typeof link !== "object") {
      throw validationError(`Field 'links[${index}]' must be a string or object`);
    }

    requireString(link.url, `links[${index}].url`);

    return {
      url: link.url.trim(),
      label:
        typeof link.label === "string" && link.label.trim()
          ? link.label.trim()
          : null,
    };
  });
}

function normalizeStatus(value) {
  if (value === undefined) {
    return undefined;
  }

  requireString(value, "status");
  const normalizedStatus = value.trim();

  if (!allowedStatuses.includes(normalizedStatus)) {
    throw validationError(
      "Field 'status' must be one of: submitted, approved, rejected, needs_revision",
    );
  }

  return normalizedStatus;
}

function calculateSha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function validateUploadedProofFile(file) {
  if (!file) {
    return;
  }

  if (!file.buffer || file.buffer.length === 0) {
    throw validationError("Uploaded proof file is empty");
  }
}

function requireSubmissionProof(file, links) {
  if (!file && links.length === 0) {
    throw validationError("Submission proof requires at least one file or link");
  }
}

async function ensureMilestoneExists(milestoneId) {
  const milestone = await milestoneRepository.getMilestoneById(milestoneId);

  if (!milestone) {
    throw notFoundError(`Milestone with id '${milestoneId}' was not found`);
  }

  return milestone;
}

async function createSubmission(payload = {}, file = null) {
  requireString(payload.milestoneId, "milestoneId");
  requireString(payload.studentId, "studentId");
  requireString(payload.description, "description");

  const milestoneId = payload.milestoneId.trim();
  const studentId = payload.studentId.trim();
  const description = payload.description.trim();
  const links = normalizeLinks(payload.links);

  validateUploadedProofFile(file);
  requireSubmissionProof(file, links);
  const milestone = await ensureMilestoneExists(milestoneId);

  if (milestone.studentId !== studentId) {
    throw validationError("Field 'studentId' must match the milestone studentId");
  }

  // Real-world rule (di balik flag): submitter harus talent sah di K1.
  if (isIntegrationValidationEnabled()) {
    const student = await getUserById(studentId);

    if (!student) {
      throw notFoundError(
        `Field 'studentId' ('${studentId}') was not found in the identity service`,
      );
    }

    if (student.role && student.role !== "talent") {
      throw validationError(
        `Field 'studentId' ('${studentId}') must reference a 'talent' user (got '${student.role}')`,
      );
    }
  }

  if (["completed", "cancelled", "canceled"].includes(milestone.status)) {
    throw conflictError("Submissions cannot be uploaded to completed or cancelled milestones");
  }

  const existingSubmission = await submissionRepository.getSubmissionByMilestoneAndStudent(
    milestoneId,
    studentId,
  );

  if (existingSubmission) {
    throw conflictError("A submission for this milestone and student already exists");
  }

  const fileHash = file ? calculateSha256(file.buffer) : null;
  const { fileUrl, storagePath } = await documentStorageService.uploadSubmissionProofFile({
    milestoneId,
    file,
  });

  try {
    const submission = await submissionRepository.createSubmission({
      milestoneId,
      studentId,
      description,
      fileUrl,
      fileName: file ? file.originalname : null,
      fileType: file ? file.mimetype : null,
      fileSize: file ? file.size : null,
      fileHash,
      links,
      status: "submitted",
    });

    await eventPublisher.publishToEventLog("submission_posted", {
      submissionId: submission.id,
      milestoneId: submission.milestoneId,
      employerId: milestone.employerId,
      studentId: submission.studentId,
      status: submission.status,
      deadline: milestone.deadline,
      submittedAt: submission.submittedAt,
    });

    return submission;
  } catch (error) {
    await documentStorageService.removeDocumentFile(storagePath);

    if (error.code === "23505") {
      throw conflictError("A submission for this milestone and student already exists");
    }

    throw error;
  }
}

async function listSubmissions(filters = {}) {
  const normalizedFilters = {};

  if (filters.milestoneId !== undefined) {
    requireString(filters.milestoneId, "milestoneId");
    normalizedFilters.milestoneId = filters.milestoneId.trim();
  }

  if (filters.studentId !== undefined) {
    requireString(filters.studentId, "studentId");
    normalizedFilters.studentId = filters.studentId.trim();
  }

  if (filters.status !== undefined) {
    normalizedFilters.status = normalizeStatus(filters.status);
  }

  return submissionRepository.listSubmissions(normalizedFilters);
}

async function getSubmissionById(id) {
  requireString(id, "id");

  const submission = await submissionRepository.getSubmissionById(id.trim());

  if (!submission) {
    throw notFoundError(`Submission with id '${id}' was not found`);
  }

  return submission;
}

async function getSubmissionDetail(id) {
  const submission = await getSubmissionById(id);
  const latestReview = await submissionRepository.getLatestReviewBySubmissionId(submission.id);

  return {
    ...submission,
    latestReview,
  };
}

async function getSubmissionDownload(id) {
  const submission = await getSubmissionById(id);

  if (!submission.fileUrl) {
    throw notFoundError(`Submission with id '${id}' does not have an uploaded file`);
  }

  return {
    id: submission.id,
    fileName: submission.fileName,
    fileUrl: submission.fileUrl,
    downloadStatus: "ready",
  };
}

async function ensureClientReviewerCanReview(milestone, reviewerId) {
  const reviewer = await submissionRepository.getUserById(reviewerId);

  if (!reviewer) {
    throw notFoundError(`Reviewer with id '${reviewerId}' was not found`);
  }

  if (reviewer.role !== "client") {
    throw forbiddenError("Only users with role 'client' can review submissions");
  }

  if (milestone.employerId !== reviewer.id) {
    throw forbiddenError("Only the milestone client can review this submission");
  }
}

async function createSubmissionReview(id, payload = {}) {
  requireString(id, "id");
  requireString(payload.reviewerId, "reviewerId");
  requireString(payload.status, "status");

  const normalizedStatus = payload.status.trim();
  const reviewerId = payload.reviewerId.trim();

  if (!allowedReviewStatuses.includes(normalizedStatus)) {
    throw validationError(
      "Field 'status' must be one of: approved, rejected, needs_revision",
    );
  }

  const existingSubmission = await getSubmissionById(id);

  if (existingSubmission.status === "approved") {
    throw conflictError("Approved submissions cannot be reviewed again");
  }

  const milestone = await ensureMilestoneExists(existingSubmission.milestoneId);

  await ensureClientReviewerCanReview(milestone, reviewerId);

  const { review, submission: updatedSubmission } =
    await submissionRepository.createSubmissionReviewAndUpdateStatus({
      submissionId: existingSubmission.id,
      reviewerId,
      status: normalizedStatus,
      notes: typeof payload.notes === "string" && payload.notes.trim()
        ? payload.notes.trim()
        : null,
    });

  if (!review || !updatedSubmission) {
    throw conflictError("Approved submissions cannot be reviewed again");
  }

  await eventPublisher.publishToEventLog(reviewStatusEventTypes[normalizedStatus], {
    submissionId: updatedSubmission.id,
    milestoneId: updatedSubmission.milestoneId,
    studentId: updatedSubmission.studentId,
    reviewerId,
    previousStatus: existingSubmission.status,
    status: updatedSubmission.status,
    reviewId: review.id,
    approvedBy: updatedSubmission.approvedBy,
    approvedAt: updatedSubmission.approvedAt,
    updatedAt: updatedSubmission.updatedAt,
  });

  return {
    submission: updatedSubmission,
    review,
  };
}

module.exports = {
  createSubmission,
  listSubmissions,
  getSubmissionById,
  getSubmissionDetail,
  getSubmissionDownload,
  createSubmissionReview,
};
