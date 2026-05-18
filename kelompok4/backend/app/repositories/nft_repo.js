const prisma = require("../core/prisma");

function createNftRecord(payload) {
  return prisma.nftRecord.create({
    data: {
      assessmentId: payload.assessmentId,
      teamId: payload.teamId,
      walletAddress: payload.walletAddress,
      contractAddress: payload.contractAddress,
      tokenId: payload.tokenId,
      txHash: payload.txHash,
      network: payload.network,
      metadataUri: payload.metadataUri,
    },
  });
}

function listNftsByTeam(teamId) {
  return prisma.nftRecord.findMany({
    where: { teamId },
    orderBy: { mintedAt: "asc" },
  });
}

function getNftById(id) {
  return prisma.nftRecord.findUnique({ where: { id } });
}

module.exports = {
  createNftRecord,
  listNftsByTeam,
  getNftById,
};
