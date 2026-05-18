const crypto = require("crypto");
const documentRepository = require("../repositories/document_repo");
const documentReviewRepository = require("../repositories/document_review_repo");
const { notFoundError, validationError } = require("../core/api_error");
const documentStorageService = require("./document_storage_service");

const allowedReviewStatuses = ["pending", "approved", "rejected", "needs_revision"];

function requireString(value, fieldName) {
  if (!value || typeof value !== "string" || !value.trim()) {
    throw validationError(`Field '${fieldName}' is required`);
  }
}

function requireUploadedPdf(file) {
  if (!file) {
    throw validationError("Field 'file' is required");
  }

  if (file.mimetype !== "application/pdf") {
    throw validationError("Only PDF files are allowed");
  }

  if (!file.buffer || file.buffer.length === 0) {
    throw validationError("Uploaded file is empty");
  }
}

function calculateSha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function createDocument(payload = {}, file = null) {
  requireString(payload.teamId, "teamId");
  requireString(payload.uploaderId, "uploaderId");
  requireUploadedPdf(file);

  const normalizedTeamId = payload.teamId.trim();
  const normalizedUploaderId = payload.uploaderId.trim();
  const description =
    typeof payload.description === "string" && payload.description.trim()
      ? payload.description.trim()
      : null;
  const fileHash = calculateSha256(file.buffer);

  const { fileUrl, storagePath } = await documentStorageService.uploadDocumentFile({
    teamId: normalizedTeamId,
    file,
  });

  try {
    return await documentRepository.createDocument({
      teamId: normalizedTeamId,
      uploaderId: normalizedUploaderId,
      fileUrl,
      fileName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
      fileHash,
      description,
    });
  } catch (error) {
    await documentStorageService.removeDocumentFile(storagePath);
    throw error;
  }
}

async function listDocumentsByTeam(teamId) {
  requireString(teamId, "teamId");
  return documentRepository.listDocumentsByTeam(teamId.trim());
}

async function getDocumentById(id) {
  requireString(id, "id");

  const document = await documentRepository.getDocumentById(id.trim());

  if (!document) {
    throw notFoundError(`Document with id '${id}' was not found`);
  }

  return document;
}

async function getDocumentDetail(id) {
  const document = await getDocumentById(id);
  const latestReview = await documentReviewRepository.getLatestReviewByDocumentId(document.id);

  return {
    ...document,
    latestReview,
  };
}

async function getDocumentDownload(id) {
  const document = await getDocumentById(id);

  return {
    id: document.id,
    fileName: document.fileName,
    fileUrl: document.fileUrl,
    downloadStatus: "ready",
  };
}

async function createDocumentReview(documentId, payload = {}) {
  requireString(documentId, "id");
  requireString(payload.reviewerId, "reviewerId");
  requireString(payload.status, "status");

  if (!allowedReviewStatuses.includes(payload.status.trim())) {
    throw validationError(
      "Field 'status' must be one of: pending, approved, rejected, needs_revision",
    );
  }

  const document = await getDocumentById(documentId);

  const review = await documentReviewRepository.createDocumentReview({
    documentId: document.id,
    reviewerId: payload.reviewerId.trim(),
    status: payload.status.trim(),
    notes: typeof payload.notes === "string" ? payload.notes.trim() : null,
  });

  return {
    documentId: document.id,
    review,
  };
}

module.exports = {
  createDocument,
  listDocumentsByTeam,
  getDocumentById,
  getDocumentDetail,
  getDocumentDownload,
  createDocumentReview,
};
