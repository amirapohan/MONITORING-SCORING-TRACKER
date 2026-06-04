const assert = require("assert");
const path = require("path");

const appRoot = path.join(__dirname, "..", "app");

function mockModule(relativePath, exports) {
  const fullPath = path.join(appRoot, relativePath);
  require.cache[require.resolve(fullPath)] = { exports };
}

async function main() {
  const completionRecord = {
    id: "pc-1",
    projectId: "123",
    projectTitle: "Project Alpha",
    clientId: "client-1",
    actorId: "client-1",
    status: "completed",
    completedAt: "2026-06-01T00:00:00.000Z",
    notes: null,
  };

  const certificates = [];
  const publishedEvents = [];
  let lockReleased = false;

  mockModule("repositories/project_completion_repo.js", {
    getProjectCompletionByProjectId: async () => null,
    createProjectCompletion: async () => completionRecord,
  });
  mockModule("repositories/certificate_repo.js", {
    createCertificateRecord: async (payload) => {
      const record = {
        id: `cert-${certificates.length + 1}`,
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
        mintStatus: payload.mintStatus,
        network: payload.network ?? null,
        contractAddress: payload.contractAddress ?? null,
        tokenId: payload.tokenId ?? null,
        txHash: payload.txHash ?? null,
        mintedAt: payload.mintedAt ?? null,
      };
      certificates.push(record);
      return record;
    },
    updateCertificateRecord: async (id, payload) => {
      const record = certificates.find((item) => item.id === id);
      Object.assign(record, payload);
      return record;
    },
  });
  mockModule("core/project_directory.js", {
    getProjectById: async () => ({
      id: "123",
      title: "Project Alpha",
      clientId: "client-1",
      acceptedTalentIds: ["talent-1", "talent-2"],
    }),
  });
  mockModule("core/user_directory.js", {
    getUserById: async (id) => ({
      id,
      role: id === "client-1" ? "client" : "talent",
      name: id === "talent-1" ? "Talent One" : id === "talent-2" ? "Talent Two" : "Client One",
      email: null,
    }),
  });
  mockModule("core/redis_lock.js", {
    acquireLock: async () => ({ key: "lock", token: "token" }),
    releaseLock: async () => {
      lockReleased = true;
    },
  });
  mockModule("services/certificate_template_service.js", {
    renderCertificateHtml: async ({ talentName, projectTitle }) =>
      `<html><body>${talentName} - ${projectTitle}</body></html>`,
  });
  mockModule("services/certificate_pdf_service.js", {
    renderPdfFromHtml: async () => ({
      pdfBuffer: Buffer.from("pdf"),
    }),
  });
  mockModule("services/document_storage_service.js", {
    uploadCertificatePdf: async ({ projectId, talentId }) => ({
      fileUrl: `http://minio/documents/certificate/project_${projectId}/${talentId}.pdf`,
      storagePath: `certificate/project_${projectId}/${talentId}.pdf`,
    }),
  });
  mockModule("services/ipfs_metadata_service.js", {
    pinMetadataJson: async ({ name }) => ({
      cid: `cid-${name}`,
      metadataUri: `ipfs://cid-${name}`,
    }),
  });
  mockModule("services/nft_mint_service.js", {
    mintCertificateNft: async () => ({
      network: "base-sepolia",
      contractAddress: "0xContract",
      txHash: "0xTxHash",
      tokenId: "1",
    }),
  });
  mockModule("services/event_publisher.js", {
    publishToEventLog: async (eventType, payload) => {
      publishedEvents.push({ eventType, payload });
    },
  });

  process.env.BASE_SEPOLIA_RECIPIENT_WALLET = "0x1111111111111111111111111111111111111111";

  const servicePath = path.join(appRoot, "services", "project_completion_service.js");
  delete require.cache[require.resolve(servicePath)];
  const projectCompletionService = require(servicePath);

  const result = await projectCompletionService.completeProject("123", {
    clientId: "client-1",
    actorId: "client-1",
  });

  assert.strictEqual(result.projectCompletion.id, "pc-1");
  assert.strictEqual(result.certificates.length, 2);
  assert.strictEqual(result.failures.length, 0);
  assert.ok(lockReleased, "redis lock should be released");
  assert.ok(
    publishedEvents.some((event) => event.eventType === "project_selesai"),
    "project_selesai event should be published",
  );
  assert.ok(
    publishedEvents.some((event) => event.eventType === "certificate_generated"),
    "certificate_generated event should be published",
  );
  assert.ok(
    publishedEvents.some((event) => event.eventType === "certificate_nft_minted"),
    "certificate_nft_minted event should be published",
  );

  console.log("certificate pipeline smoke test passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
