import Redis from "ioredis";

import { config } from ".";

const createRedisClient = (): Redis => {
  if (config.nodeEnv === "test") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RedisMock = require("ioredis-mock");
    return new RedisMock() as Redis;
  }
  return new Redis(config.redisUrl, { lazyConnect: true });
};

export const redisClient = createRedisClient();
