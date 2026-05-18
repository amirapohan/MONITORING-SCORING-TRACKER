const crypto = require("crypto");
const { validationError } = require("../core/api_error");
const {
  getSupabaseBucketName,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} = require("../core/supabase");

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

async function uploadFileToSupabase({ storagePath, file }) {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  const bucketName = getSupabaseBucketName();

  const uploadResponse = await fetch(
    `${supabaseUrl}/storage/v1/object/${bucketName}/${storagePath}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "Content-Type": file.mimetype,
        "x-upsert": "false",
      },
      body: file.buffer,
    },
  );

  if (!uploadResponse.ok) {
    const uploadError = await uploadResponse.text();
    throw new Error(`Failed to upload file to Supabase Storage: ${uploadError}`);
  }

  return `${supabaseUrl}/storage/v1/object/public/${bucketName}/${storagePath}`;
}

async function uploadDocumentFile({ teamId, file }) {
  if (!file) {
    throw validationError("Field 'file' is required");
  }

  const storagePath = buildStoragePath("documents", teamId, file.originalname);
  const publicUrl = await uploadFileToSupabase({ storagePath, file });

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
  const publicUrl = await uploadFileToSupabase({ storagePath, file });

  return {
    fileUrl: publicUrl,
    storagePath,
  };
}

async function removeDocumentFile(storagePath) {
  if (!storagePath) {
    return;
  }

  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  const bucketName = getSupabaseBucketName();

  await fetch(`${supabaseUrl}/storage/v1/object/${bucketName}/${storagePath}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
  });
}

module.exports = {
  uploadDocumentFile,
  uploadSubmissionProofFile,
  removeDocumentFile,
};
