import { redisClient } from "../config/redis";

const TOKEN_PREFIX = "blacklist:jti:";
const DEACTIVATED_PREFIX = "blacklist:user:";

export const tokenBlacklistRepository = {
  async addToken(jti: string, ttlSeconds: number): Promise<void> {
    if (ttlSeconds > 0) {
      await redisClient.setex(`${TOKEN_PREFIX}${jti}`, ttlSeconds, "1");
    }
  },

  async isTokenBlacklisted(jti: string): Promise<boolean> {
    const result = await redisClient.exists(`${TOKEN_PREFIX}${jti}`);
    return result === 1;
  },

  async addDeactivatedUser(userId: string, ttlSeconds: number): Promise<void> {
    await redisClient.setex(`${DEACTIVATED_PREFIX}${userId}`, ttlSeconds, "1");
  },

  async isUserDeactivated(userId: string): Promise<boolean> {
    const result = await redisClient.exists(`${DEACTIVATED_PREFIX}${userId}`);
    return result === 1;
  },
};
