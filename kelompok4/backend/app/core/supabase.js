function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function getSupabaseUrl() {
  return getRequiredEnv("SUPABASE_URL").replace(/\/+$/, "");
}

function getSupabaseServiceRoleKey() {
  return getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
}

function getSupabaseBucketName() {
  return getRequiredEnv("SUPABASE_STORAGE_BUCKET");
}

module.exports = {
  getSupabaseUrl,
  getSupabaseServiceRoleKey,
  getSupabaseBucketName,
};
