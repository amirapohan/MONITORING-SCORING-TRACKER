import type { NextFunction, Request, Response } from "express";

import { redisClient } from "../config/redis";

export const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  keyPrefix: string;
}) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (process.env.NODE_ENV === "test") {
      return next();
    }

    const ip = req.ip ?? "unknown";
    const key = `ratelimit:${options.keyPrefix}:${ip}`;

    try {
      const current = await redisClient.incr(key);
      if (current === 1) {
        await redisClient.pexpire(key, options.windowMs);
      }

      if (current > options.max) {
        const ttl = await redisClient.pttl(key);
        res.status(429).json({
          success: false,
          message: "Too many requests, please try again later",
          retryAfter: Math.ceil(ttl / 1000),
        });
        return;
      }
    } catch {
      // Redis unavailable: fail-open, let the request through
      console.error(`[rateLimit] Redis unavailable for key ${options.keyPrefix}, skipping`);
    }

    next();
  };
