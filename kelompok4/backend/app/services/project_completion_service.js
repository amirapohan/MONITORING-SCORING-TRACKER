const projectCompletionRepository = require("../repositories/project_completion_repo");
const certificateRepository = require("../repositories/certificate_repo");
const projectDirectory = require("../core/project_directory");
const { getUserById } = require("../core/user_directory");
const { acquireLock, releaseLock } = require("../core/redis_lock");
const { renderCertificateHtml } = require("./certificate_template_service");
const { renderPdfFromHtml } = require("./certificate_pdf_service");
const storageService = require("./document_storage_service");
const { pinMetadataJson } = require("./ipfs_metadata_service");
const { mintCertificateNft } = require("./nft_mint_service");
const eventPublisher = require("./event_publisher");
const {
  ApiError,
  configurationError,
  conflictError,
  forbiddenError,
  notFoundError,
  unprocessableEntityError,
  validationError,
} = require("../core/api_error");

function requireString(value, fieldName) {
  if (!value || typeof value !== "string" || !value.trim()) {
    throw validationError(`Field '${fieldName}' is required`);
  }
}

function getCertificateIssuerName() {
  return process.env.CERTIFICATE_ISSUER_NAME || "Kelompok 4 Tracker Service";
}

function getRecipientWalletAddress() {
  const value = process.env.BASE_SEPOLIA_RECIPIENT_WALLET;

  if (!value || !value.trim()) {
    throw configurationError("Missing required environment variable: BASE_SEPOLIA_RECIPIENT_WALLET");
  }

  return value.trim();
}

function getLockKey(projectId) {
  return `lock:project-complete:${projectId}`;
}

function buildCertificateMetadata({ talentId, talentName, projectId, projectTitle, pdfUrl }) {
  return {
    name: `Project Certificate - ${talentName}`,
    description: `Certificate of completion for project ${projectTitle}`,
    attributes: [
      { trait_type: "Talent", value: talentName },
      { trait_type: "Talent ID", value: talentId },
      { trait_type: "Project", value: projectTitle },
      { trait_type: "Project ID", value: projectId },
      { trait_type: "Network", value: "base-sepolia" },
    ],
    animation_url: pdfUrl,
    artifact_url: pdfUrl,
  };
}

async function getProjectOrThrow(projectId) {
  const project = await projectDirectory.getProjectById(projectId);

  if (!project) {
    throw notFoundError(`Project with id '${projectId}' was not found in the bidding service`);
  }

  return project;
}

async function getTalentOrThrow(talentId) {
  const user = await getUserById(talentId);

  if (!user) {
    throw notFoundError(`Talent with id '${talentId}' was not found in the identity service`);
  }

  return user;
}

async function createCertificateForTalent({
  projectCompletion,
  project,
  talent,
  recipientWallet,
}) {
  const initialCertificate = await certificateRepository.createCertificateRecord({
    projectCompletionId: projectCompletion.id,
    projectId: project.id,
    talentId: talent.id,
    talentName: talent.name || talent.id,
    projectTitle: project.title || project.id,
    walletAddress: recipientWallet,
    mintStatus: "pending",
  });
  let currentCertificate = initialCertificate;

  try {
    const html = await renderCertificateHtml({
      talentName: talent.name || talent.id,
      projectTitle: project.title || project.id,
      completedAt: projectCompletion.completedAt,
      issuerName: getCertificateIssuerName(),
    });

    const pdfResult = await renderPdfFromHtml({
      html,
      fileNamePrefix: `certificate-${project.id}-${talent.id}`,
    });

    const { fileUrl, storagePath } = await storageService.uploadCertificatePdf({
      projectId: project.id,
      talentId: talent.id,
      fileName: `${talent.id}.pdf`,
      pdfBuffer: pdfResult.pdfBuffer,
    });

    currentCertificate = await certificateRepository.updateCertificateRecord(initialCertificate.id, {
      certificatePdfUrl: fileUrl,
      certificatePdfStoragePath: storagePath,
      metadataIpfsCid: initialCertificate.metadataIpfsCid,
      metadataUri: initialCertificate.metadataUri,
      mintStatus: initialCertificate.mintStatus,
      network: initialCertificate.network,
      contractAddress: initialCertificate.contractAddress,
      tokenId: initialCertificate.tokenId,
      txHash: initialCertificate.txHash,
      mintedAt: initialCertificate.mintedAt,
    });

    const metadata = buildCertificateMetadata({
      talentId: talent.id,
      talentName: talent.name || talent.id,
      projectId: project.id,
      projectTitle: project.title || project.id,
      pdfUrl: fileUrl,
    });

    const { cid, metadataUri } = await pinMetadataJson(metadata);
    currentCertificate = await certificateRepository.updateCertificateRecord(initialCertificate.id, {
      certificatePdfUrl: currentCertificate.certificatePdfUrl,
      certificatePdfStoragePath: currentCertificate.certificatePdfStoragePath,
      metadataIpfsCid: cid,
      metadataUri,
      mintStatus: currentCertificate.mintStatus,
      network: currentCertificate.network,
      contractAddress: currentCertificate.contractAddress,
      tokenId: currentCertificate.tokenId,
      txHash: currentCertificate.txHash,
      mintedAt: currentCertificate.mintedAt,
    });

    const mintResult = await mintCertificateNft({
      metadataUri,
      recipientWallet,
    });

    const updated = await certificateRepository.updateCertificateRecord(initialCertificate.id, {
      certificatePdfUrl: currentCertificate.certificatePdfUrl,
      certificatePdfStoragePath: currentCertificate.certificatePdfStoragePath,
      metadataIpfsCid: currentCertificate.metadataIpfsCid,
      metadataUri: currentCertificate.metadataUri,
      mintStatus: "minted",
      network: mintResult.network,
      contractAddress: mintResult.contractAddress,
      tokenId: mintResult.tokenId,
      txHash: mintResult.txHash,
      mintedAt: new Date().toISOString(),
    });

    await eventPublisher.publishToEventLog("certificate_generated", {
      certificateId: updated.id,
      projectId: updated.projectId,
      talentId: updated.talentId,
      certificatePdfUrl: updated.certificatePdfUrl,
      metadataUri: updated.metadataUri,
    });

    await eventPublisher.publishToEventLog("certificate_nft_minted", {
      certificateId: updated.id,
      projectId: updated.projectId,
      talentId: updated.talentId,
      walletAddress: updated.walletAddress,
      contractAddress: updated.contractAddress,
      tokenId: updated.tokenId,
      txHash: updated.txHash,
      network: updated.network,
    });

    return updated;
  } catch (error) {
    await certificateRepository.updateCertificateRecord(initialCertificate.id, {
      mintStatus: "failed",
      certificatePdfUrl: currentCertificate.certificatePdfUrl,
      certificatePdfStoragePath: currentCertificate.certificatePdfStoragePath,
      metadataIpfsCid: currentCertificate.metadataIpfsCid,
      metadataUri: currentCertificate.metadataUri,
      network: currentCertificate.network,
      contractAddress: currentCertificate.contractAddress,
      tokenId: currentCertificate.tokenId,
      txHash: currentCertificate.txHash,
      mintedAt: currentCertificate.mintedAt,
    }).catch(() => {});

    throw error;
  }
}

async function completeProject(projectId, payload = {}) {
  requireString(projectId, "projectId");
  requireString(payload.clientId, "clientId");
  requireString(payload.actorId, "actorId");

  const normalizedProjectId = projectId.trim();
  const clientId = payload.clientId.trim();
  const actorId = payload.actorId.trim();

  if (clientId !== actorId) {
    throw forbiddenError("Field 'actorId' must match the client who completes the project");
  }

  const lock = await acquireLock(getLockKey(normalizedProjectId), 60);

  if (!lock) {
    throw conflictError(`Project '${normalizedProjectId}' is already being completed`);
  }

  try {
    const existingCompletion =
      await projectCompletionRepository.getProjectCompletionByProjectId(normalizedProjectId);

    if (existingCompletion) {
      throw conflictError(`Project '${normalizedProjectId}' has already been completed`);
    }

    const project = await getProjectOrThrow(normalizedProjectId);

    if (String(project.clientId) !== clientId) {
      throw forbiddenError("Only the project client can complete the project");
    }

    if (!Array.isArray(project.acceptedTalentIds) || project.acceptedTalentIds.length === 0) {
      throw unprocessableEntityError("Project does not have any awarded talents to certify");
    }

    const recipientWallet = getRecipientWalletAddress();
    const projectCompletion = await projectCompletionRepository.createProjectCompletion({
      projectId: normalizedProjectId,
      projectTitle: project.title || normalizedProjectId,
      clientId,
      actorId,
      status: "completed",
      notes: typeof payload.notes === "string" && payload.notes.trim()
        ? payload.notes.trim()
        : null,
      completedAt: new Date().toISOString(),
    });

    await eventPublisher.publishToEventLog("project_selesai", {
      projectId: projectCompletion.projectId,
      clientId: projectCompletion.clientId,
      talentIds: project.acceptedTalentIds,
      completedAt: projectCompletion.completedAt,
    });

    const certificates = [];
    const failures = [];

    for (const talentId of project.acceptedTalentIds) {
      try {
        const talent = await getTalentOrThrow(talentId);
        const certificate = await createCertificateForTalent({
          projectCompletion,
          project,
          talent,
          recipientWallet,
        });
        certificates.push(certificate);
      } catch (error) {
        failures.push({
          talentId,
          message: error.message,
        });
      }
    }

    return {
      projectCompletion,
      certificates,
      failures,
    };
  } catch (error) {
    if (error && error.code === "P2002") {
      throw conflictError(`Project '${normalizedProjectId}' has already been completed`);
    }

    if (error.statusCode) {
      throw error;
    }

    throw new ApiError(500, "PROJECT_COMPLETION_FAILED", error.message);
  } finally {
    await releaseLock(lock).catch(() => {});
  }
}

module.exports = {
  completeProject,
};
