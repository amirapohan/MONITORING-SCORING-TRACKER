const crypto = require("crypto");
const { validationError } = require("../core/api_error");
const {
  getMinioClient,
  getMinioBucketName,
  getMinioPublicUrl,
} = require("../core/minio");

function createSafeFileName(fileName) {
  return fileName
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .toLowerCase();
}

function buildStoragePath(folderName, ownerId, fileName) {
  const uniquePrefix = crypto.randomUUID();
  return `${folderName}/${ownerId}/${uniquePrefix}-${createSafeFileName(fileName)}`;
}

// URL permanen yang disimpan ke DB. Service lain di tailnet mengaksesnya
// langsung lewat MagicDNS Tailscale (bucket ber-policy public-read).
function buildPublicFileUrl(storagePath) {
  return `${getMinioPublicUrl()}/${getMinioBucketName()}/${storagePath}`;
}

async function uploadFileToMinio({ storagePath, file }) {
  const client = getMinioClient();
  const bucketName = getMinioBucketName();

  await client.putObject(bucketName, storagePath, file.buffer, file.size, {
    "Content-Type": file.mimetype,
  });

  return buildPublicFileUrl(storagePath);
}

async function uploadDocumentFile({ teamId, file }) {
  if (!file) {
    throw validationError("Field 'file' is required");
  }

  const storagePath = buildStoragePath("documents", teamId, file.originalname);
  const publicUrl = await uploadFileToMinio({ storagePath, file });

  return {
    fileUrl: publicUrl,
    storagePath,
  };
}

async function uploadSubmissionProofFile({ milestoneId, file }) {
  if (!file) {
    return {
      fileUrl: null,
      storagePath: null,
    };
  }

  const storagePath = buildStoragePath("milestone-submissions", milestoneId, file.originalname);
  const publicUrl = await uploadFileToMinio({ storagePath, file });

  return {
    fileUrl: publicUrl,
    storagePath,
  };
}

async function removeDocumentFile(storagePath) {
  if (!storagePath) {
    return;
  }

  const client = getMinioClient();
  const bucketName = getMinioBucketName();

  await client.removeObject(bucketName, storagePath);
}

module.exports = {
  uploadDocumentFile,
  uploadSubmissionProofFile,
  removeDocumentFile,
};
