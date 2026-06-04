const prisma = require("../core/prisma");

function mapCertificateRecord(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    projectCompletionId: row.projectCompletionId,
    projectId: row.projectId,
    talentId: row.talentId,
    talentName: row.talentName,
    projectTitle: row.projectTitle,
    walletAddress: row.walletAddress,
    certificatePdfUrl: row.certificatePdfUrl,
    certificatePdfStoragePath: row.certificatePdfStoragePath,
    metadataIpfsCid: row.metadataIpfsCid,
    metadataUri: row.metadataUri,
    mintStatus: row.mintStatus,
    network: row.network,
    contractAddress: row.contractAddress,
    tokenId: row.tokenId,
    txHash: row.txHash,
    mintedAt: row.mintedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function createCertificateRecord(payload) {
  const row = await prisma.certificateRecord.create({
    data: {
      projectCompletionId: payload.projectCompletionId,
      projectId: payload.projectId,
      talentId: payload.talentId,
      talentName: payload.talentName,
      projectTitle: payload.projectTitle,
      walletAddress: payload.walletAddress,
      certificatePdfUrl: payload.certificatePdfUrl ?? null,
      certificatePdfStoragePath: payload.certificatePdfStoragePath ?? null,
      metadataIpfsCid: payload.metadataIpfsCid ?? null,
      metadataUri: payload.metadataUri ?? null,
      mintStatus: payload.mintStatus || "pending",
      network: payload.network ?? null,
      contractAddress: payload.contractAddress ?? null,
      tokenId: payload.tokenId ?? null,
      txHash: payload.txHash ?? null,
      mintedAt: payload.mintedAt ? new Date(payload.mintedAt) : null,
    },
  });

  return mapCertificateRecord(row);
}

async function updateCertificateRecord(id, payload) {
  const row = await prisma.certificateRecord.update({
    where: { id },
    data: {
      certificatePdfUrl: payload.certificatePdfUrl,
      certificatePdfStoragePath: payload.certificatePdfStoragePath,
      metadataIpfsCid: payload.metadataIpfsCid,
      metadataUri: payload.metadataUri,
      mintStatus: payload.mintStatus,
      network: payload.network,
      contractAddress: payload.contractAddress,
      tokenId: payload.tokenId,
      txHash: payload.txHash,
      mintedAt: payload.mintedAt ? new Date(payload.mintedAt) : payload.mintedAt,
    },
  });

  return mapCertificateRecord(row);
}

async function listCertificatesByProjectId(projectId) {
  const rows = await prisma.certificateRecord.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });

  return rows.map(mapCertificateRecord);
}

module.exports = {
  createCertificateRecord,
  updateCertificateRecord,
  listCertificatesByProjectId,
  mapCertificateRecord,
};
