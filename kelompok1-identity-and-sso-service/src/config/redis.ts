import Redis from "ioredis";

import { config } from ".";

const createRedisClient = (): Redis => {
  if (config.nodeEnv === "test") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RedisMock = require("ioredis-mock");
    return new RedisMock() as Redis;
  }
  // Configure the client to fail-fast when Redis is unreachable:
  // - `enableOfflineQueue: false` : do not queue commands while disconnected
  // - `maxRetriesPerRequest: 0`   : do not retry commands, return error quickly
  // - `connectTimeout`           : short connect timeout (ms)
  // - `lazyConnect: true`        : connect on first command
  return new Redis(config.redisUrl, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    connectTimeout: 2000,
  });
};

export const redisClient = createRedisClient();
