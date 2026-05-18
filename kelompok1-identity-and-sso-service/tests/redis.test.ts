import bcrypt from "bcryptjs";
import type { Express, Request, Response } from "express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { prisma as prismaClient } from "../src/models/prisma";

type PrismaClient = typeof prismaClient;

const uniqueId = Date.now();

let app: Express;
let prisma: PrismaClient;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret";
  process.env.INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? "test-internal-key";

  const appModule = await import("../src/app");
  const prismaModule = await import("../src/models/prisma");

  app = appModule.default;
  prisma = prismaModule.prisma;

  await prisma.$connect();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: `redis.${uniqueId}` } } });
  await prisma.$disconnect();
});

describe("Token blacklist", () => {
  const userEmail = `redis.${uniqueId}.bl@example.com`;

  it("access token is rejected after logout (token blacklisted)", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ name: "BL User", email: userEmail, password: "Password123!", role: "talent" });

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: userEmail, password: "Password123!" });

    const { accessToken, refreshToken } = loginRes.body.data;

    await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refreshToken });

    const profileRes = await request(app)
      .get("/api/auth/profile")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(profileRes.status).toBe(401);
    expect(profileRes.body.message).toMatch(/revoked/i);
  });

  it("access token is rejected immediately after user is deactivated", async () => {
    const adminEmail = `redis.${uniqueId}.admin@example.com`;

    try {
      const hashedPassword = await bcrypt.hash("Password123!", 12);
      await prisma.user.create({
        data: { name: "BL Admin", email: adminEmail, password: hashedPassword, role: "admin", isActive: true },
      });

      const adminLoginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: adminEmail, password: "Password123!" });
      const adminToken = adminLoginRes.body.data.accessToken;

      const targetLoginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: userEmail, password: "Password123!" });
      const targetId = targetLoginRes.body.data.user.id;
      const targetToken = targetLoginRes.body.data.accessToken;

      await request(app)
        .patch(`/api/auth/users/${targetId}/deactivate`)
        .set("Authorization", `Bearer ${adminToken}`);

      const profileRes = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${targetToken}`);

      // Token is rejected (either "revoked" or "deactivated" — both are correct)
      // The specific deactivated-user Redis path is verified in the TTL unit test
      expect(profileRes.status).toBe(401);
    } finally {
      await prisma.user.deleteMany({ where: { email: adminEmail } });
    }
  });

  it("uses JWT_ACCESS_EXPIRES as Redis TTL for deactivated users", async () => {
    const { authService } = await import("../src/services/auth.service");
    const { config } = await import("../src/config");
    const { tokenBlacklistRepository } = await import("../src/repositories/tokenBlacklist.repository");
    const adminEmail = `redis.${uniqueId}.ttl.admin@example.com`;
    const targetEmail = `redis.${uniqueId}.ttl.target@example.com`;
    const originalAccessExpiresIn = config.jwt.accessExpiresIn;
    const addDeactivatedUserSpy = vi
      .spyOn(tokenBlacklistRepository, "addDeactivatedUser")
      .mockResolvedValue(undefined);

    try {
      config.jwt.accessExpiresIn = "2h";
      const hashedPassword = await bcrypt.hash("Password123!", 12);
      const admin = await prisma.user.create({
        data: { name: "TTL Admin", email: adminEmail, password: hashedPassword, role: "admin", isActive: true },
      });
      const target = await prisma.user.create({
        data: { name: "TTL Target", email: targetEmail, password: hashedPassword, role: "talent", isActive: true },
      });

      await authService.deactivateUser(admin.id, target.id);

      expect(addDeactivatedUserSpy).toHaveBeenCalledWith(target.id, 7200);
    } finally {
      config.jwt.accessExpiresIn = originalAccessExpiresIn;
      addDeactivatedUserSpy.mockRestore();
      await prisma.user.deleteMany({ where: { email: { in: [adminEmail, targetEmail] } } });
    }
  });
});

describe("Rate limiter middleware", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls next() when request count is within limit", async () => {
    const { createRateLimiter } = await import("../src/middlewares/rateLimit");
    const { redisClient } = await import("../src/config/redis");

    const limiter = createRateLimiter({ windowMs: 60_000, max: 3, keyPrefix: `unit-test-${uniqueId}` });
    const ip = `192.168.${uniqueId % 255}.1`;
    const key = `ratelimit:unit-test-${uniqueId}:${ip}`;

    try {
      const mockReq = { ip } as Request;
      const mockRes = {} as Response;
      const next = vi.fn();

      // Temporarily enable rate limiting for this test
      process.env.NODE_ENV = "production";
      await limiter(mockReq, mockRes, next);
      process.env.NODE_ENV = "test";

      expect(next).toHaveBeenCalledOnce();
    } finally {
      await redisClient.del(key);
    }
  });

  it("returns 429 when request count exceeds the limit", async () => {
    const { createRateLimiter } = await import("../src/middlewares/rateLimit");
    const { redisClient } = await import("../src/config/redis");

    const limiter = createRateLimiter({ windowMs: 60_000, max: 2, keyPrefix: `unit-limit-${uniqueId}` });
    const ip = `192.168.${uniqueId % 255}.2`;
    const key = `ratelimit:unit-limit-${uniqueId}:${ip}`;

    const statusMock = vi.fn().mockReturnThis();
    const jsonMock = vi.fn();
    const mockReq = { ip } as Request;
    const mockRes = { status: statusMock, json: jsonMock } as unknown as Response;
    const next = vi.fn();

    try {
      process.env.NODE_ENV = "production";

      await limiter(mockReq, mockRes, next); // count = 1 → ok
      await limiter(mockReq, mockRes, next); // count = 2 → ok
      await limiter(mockReq, mockRes, next); // count = 3 → 429

      process.env.NODE_ENV = "test";

      expect(next).toHaveBeenCalledTimes(2);
      expect(statusMock).toHaveBeenCalledWith(429);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, retryAfter: expect.any(Number) }),
      );
    } finally {
      process.env.NODE_ENV = "test";
      await redisClient.del(key);
    }
  });
});
