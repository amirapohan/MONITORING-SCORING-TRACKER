import dotenv from "dotenv";

dotenv.config();

const parseInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const config = {
  port: parseInteger(process.env.PORT, 3000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  jwt: {
    secret: process.env.JWT_SECRET ?? "default-secret-change-me",
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES ?? "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES ?? "7d",
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
  },
  internalApiKey: process.env.INTERNAL_API_KEY ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  directUrl: process.env.DIRECT_URL ?? "",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
};

if (!config.databaseUrl) {
  throw new Error("Missing required environment variable: DATABASE_URL");
}

if (!config.directUrl) {
  throw new Error("Missing required environment variable: DIRECT_URL");
}

if (config.nodeEnv === "production" && !process.env.JWT_SECRET) {
  throw new Error("Missing required environment variable: JWT_SECRET");
}

if (config.nodeEnv === "production" && !config.internalApiKey) {
  throw new Error("Missing required environment variable: INTERNAL_API_KEY");
}
