const { Client } = require("minio");

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function getOptionalEnv(name, fallback) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

// Endpoint internal yang dipakai backend untuk konek ke MinIO.
// Di dalam docker-compose ini = nama service "minio".
function getMinioEndpoint() {
  return getOptionalEnv("MINIO_ENDPOINT", "minio");
}

function getMinioPort() {
  return Number(getOptionalEnv("MINIO_PORT", "9000"));
}

function getMinioUseSSL() {
  return getOptionalEnv("MINIO_USE_SSL", "false") === "true";
}

function getMinioBucketName() {
  return getOptionalEnv("MINIO_BUCKET", "documents");
}

// Base URL yang ditaruh ke DB sebagai fileUrl. Service lain di tailnet
// mengakses file lewat URL ini (mis. http://minio-kel4.<tailnet>.ts.net:9000).
function getMinioPublicUrl() {
  return getRequiredEnv("MINIO_PUBLIC_URL").replace(/\/+$/, "");
}

let cachedClient = null;

function getMinioClient() {
  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = new Client({
    endPoint: getMinioEndpoint(),
    port: getMinioPort(),
    useSSL: getMinioUseSSL(),
    accessKey: getRequiredEnv("MINIO_ACCESS_KEY"),
    secretKey: getRequiredEnv("MINIO_SECRET_KEY"),
  });

  return cachedClient;
}

// Policy: izinkan GET anonim untuk seluruh objek di bucket.
// Setara dengan "public bucket" Supabase sebelumnya. Aman karena MinIO
// hanya dapat dijangkau dari dalam tailnet (internal antar-service).
function buildPublicReadPolicy(bucketName) {
  return JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { AWS: ["*"] },
        Action: ["s3:GetObject"],
        Resource: [`arn:aws:s3:::${bucketName}/*`],
      },
    ],
  });
}

// Idempotent: dipanggil saat startup. Buat bucket bila belum ada,
// lalu pasang policy public-read.
async function ensureBucketReady() {
  const client = getMinioClient();
  const bucketName = getMinioBucketName();

  const exists = await client.bucketExists(bucketName).catch(() => false);
  if (!exists) {
    await client.makeBucket(bucketName);
  }

  await client.setBucketPolicy(bucketName, buildPublicReadPolicy(bucketName));
}

module.exports = {
  getMinioClient,
  getMinioBucketName,
  getMinioPublicUrl,
  ensureBucketReady,
};
