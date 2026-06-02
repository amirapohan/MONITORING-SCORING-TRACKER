import type { NextFunction, Request, Response } from "express";

import { redisClient } from "../config/redis";

export const createRateLimiter =
  (options: { windowMs: number; max: number; keyPrefix: string }) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (process.env.NODE_ENV === "test") {
      return next();
    }

    const ip = req.ip ?? "unknown";
    const key = `ratelimit:${options.keyPrefix}:${ip}`;

    try {
      const current = await redisClient.incr(key);
      let ttl = await redisClient.pttl(key);

      // Fix race condition: if key has no expiration (ttl === -1), set it.
      if (ttl === -1) {
        await redisClient.pexpire(key, options.windowMs);
        ttl = options.windowMs;
      }

      if (current > options.max) {
        const retryAfter = Math.max(1, Math.ceil(ttl / 1000));
        res.status(429).json({
          success: false,
          message: "Too many requests, please try again later",
          retryAfter,
        });
        return;
      }
    } catch {
      // Redis unavailable: fail-open, let the request through
      console.error(
        `[rateLimit] Redis unavailable for key ${options.keyPrefix}, skipping`,
      );
    }

    next();
  };
