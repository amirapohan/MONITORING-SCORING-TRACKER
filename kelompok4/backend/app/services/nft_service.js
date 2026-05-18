const nftRepository = require("../repositories/nft_repo");
const { notFoundError, validationError } = require("../core/api_error");

function ensureTeamId(teamId) {
  if (!teamId || typeof teamId !== "string" || !teamId.trim()) {
    throw validationError("Field 'teamId' is required");
  }
}

function listNftsByTeam(teamId) {
  ensureTeamId(teamId);
  return nftRepository.listNftsByTeam(teamId.trim());
}

async function verifyNft(id) {
  if (!id || typeof id !== "string" || !id.trim()) {
    throw validationError("Field 'id' is required");
  }

  const nftRecord = await nftRepository.getNftById(id.trim());

  if (!nftRecord) {
    throw notFoundError(`NFT with id '${id}' was not found`);
  }

  return {
    id: nftRecord.id,
    assessmentId: nftRecord.assessmentId,
    teamId: nftRecord.teamId,
    network: nftRecord.network,
    txHash: nftRecord.txHash,
    verified: true,
    status: nftRecord.verifyStatus,
  };
}

function createMockNftFromAssessment(assessment) {
  return nftRepository.createNftRecord({
    assessmentId: assessment.id,
    teamId: assessment.teamId,
    walletAddress: assessment.walletAddress || "0x0000000000000000000000000000000000000000",
    contractAddress: "0xMockContractAddress000000000000000000000",
    tokenId: `token-${assessment.id}`,
    txHash: `0xmocktx${assessment.id}`,
    network: "polygon-mumbai",
    metadataUri: `https://example.com/metadata/${assessment.id}`,
  });
}

module.exports = {
  listNftsByTeam,
  verifyNft,
  createMockNftFromAssessment,
};
