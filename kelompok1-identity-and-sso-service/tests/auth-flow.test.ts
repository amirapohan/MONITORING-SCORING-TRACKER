import bcrypt from "bcryptjs";
import type { Express } from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { prisma as prismaClient } from "../src/models/prisma";

type PrismaClient = typeof prismaClient;

const uniqueId = Date.now();
const testUser = {
  name: "MVP Test User",
  email: `mvp.test.${uniqueId}@example.com`,
  password: "Password123!",
  updatedName: "MVP Test User Updated",
};

const adminUser = {
  name: "Authz Admin",
  email: `authz.admin.${uniqueId}@example.com`,
  password: "AdminPass123!",
};

const adminCreatedUser = {
  name: "Authz Created Admin",
  email: `authz.created.admin.${uniqueId}@example.com`,
  password: "Password123!",
};

let app: Express;
let prisma: PrismaClient;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret";
  process.env.INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "test-internal-key";
  process.env.CORS_ALLOWED_ORIGINS = "http://localhost:5173,http://localhost:3000";

  const appModule = await import("../src/app");
  const prismaModule = await import("../src/models/prisma");

  app = appModule.default;
  prisma = prismaModule.prisma;

  await prisma.$connect();
  await prisma.outboxEvent.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.user.deleteMany({
    where: {
      email: { in: [testUser.email, adminUser.email, adminCreatedUser.email] },
    },
  });
});

afterAll(async () => {
  await prisma.outboxEvent.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.user.deleteMany({
    where: {
      email: { in: [testUser.email, adminUser.email, adminCreatedUser.email] },
    },
  });
  await prisma.$disconnect();
});

describe("MVP auth flow", () => {
  it("returns health status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      status: "ok",
      service: "identity-and-sso-service",
    });
  });

  it("returns skill and subSkill enum options", async () => {
    const response = await request(app).get("/api/auth/skills/options");

    expect(response.status).toBe(200);
    expect(response.body.data.skills).toEqual(
      expect.arrayContaining(["FRONTEND_DEVELOPMENT", "BACKEND_DEVELOPMENT"]),
    );
    expect(response.body.data.subSkills).toEqual(
      expect.arrayContaining(["REACT", "NODEJS", "SUPABASE"]),
    );
    expect(response.body.data.subSkillsBySkill.FRONTEND_DEVELOPMENT).toEqual(
      expect.arrayContaining(["HTML", "CSS", "REACT"]),
    );
  });

  it("registers, logs in, refreshes, reads profile, updates profile, validates token, and logs out", async () => {
    const registerResponse = await request(app)
      .post("/api/auth/register")
      .send({
        name: testUser.name,
        email: testUser.email,
        password: testUser.password,
        role: "talent",
        skills: ["FRONTEND_DEVELOPMENT", "BACKEND_DEVELOPMENT"],
        subSkills: ["REACT", "TYPESCRIPT", "NODEJS", "SUPABASE"],
      });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.data.user).toMatchObject({
      name: testUser.name,
      email: testUser.email,
      role: "talent",
      isActive: true,
      skills: ["FRONTEND_DEVELOPMENT", "BACKEND_DEVELOPMENT"],
      subSkills: ["REACT", "TYPESCRIPT", "NODEJS", "SUPABASE"],
    });
    expect(registerResponse.body.data.user.password).toBeUndefined();

    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.data.accessToken).toEqual(expect.any(String));
    expect(loginResponse.body.data.refreshToken).toEqual(expect.any(String));

    const { accessToken, refreshToken } = loginResponse.body.data;

    const profileResponse = await request(app)
      .get("/api/auth/profile")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.data.user.email).toBe(testUser.email);

    const updateProfileResponse = await request(app)
      .put("/api/auth/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: testUser.updatedName,
        skills: ["FULLSTACK_DEVELOPMENT"],
        subSkills: ["NEXTJS", "PRISMA", "POSTGRESQL"],
      });

    expect(updateProfileResponse.status).toBe(200);
    expect(updateProfileResponse.body.data.user.name).toBe(testUser.updatedName);
    expect(updateProfileResponse.body.data.user.skills).toEqual(["FULLSTACK_DEVELOPMENT"]);
    expect(updateProfileResponse.body.data.user.subSkills).toEqual([
      "NEXTJS",
      "PRISMA",
      "POSTGRESQL",
    ]);

    const refreshResponse = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken });

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.data.accessToken).toEqual(expect.any(String));

    const validateTokenResponse = await request(app)
      .post("/internal/validate-token")
      .set("x-internal-api-key", process.env.INTERNAL_API_KEY ?? "")
      .send({ token: refreshResponse.body.data.accessToken });

    expect(validateTokenResponse.status).toBe(200);
    expect(validateTokenResponse.body.data.user.email).toBe(testUser.email);

    const logoutResponse = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refreshToken });

    expect(logoutResponse.status).toBe(200);

    const refreshAfterLogoutResponse = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken });

    expect(refreshAfterLogoutResponse.status).toBe(401);
  }, 30000);

  it("rejects duplicate email registration", async () => {
    const duplicateResponse = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Duplicate User",
        email: testUser.email,
        password: testUser.password,
        role: "talent",
      });

    expect(duplicateResponse.status).toBe(409);
  });
});

describe("Authorization", () => {
  it("returns 401 when accessing a protected endpoint without an access token", async () => {
    const response = await request(app).get("/api/auth/profile");

    expect(response.status).toBe(401);
  });

  it("returns 401 when accessing a protected endpoint with an invalid access token", async () => {
    const response = await request(app)
      .get("/api/auth/profile")
      .set("Authorization", "Bearer not-a-real-token");

    expect(response.status).toBe(401);
  });

  it("forbids non-admin users from registering an admin", async () => {
    const talentEmail = `authz.talent.${uniqueId}@example.com`;

    try {
      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Authz Talent",
          email: talentEmail,
          password: "Password123!",
          role: "talent",
        });

      expect(registerResponse.status).toBe(201);

      const loginResponse = await request(app)
        .post("/api/auth/login")
        .send({ email: talentEmail, password: "Password123!" });

      expect(loginResponse.status).toBe(200);
      const { accessToken } = loginResponse.body.data;

      const adminRegisterResponse = await request(app)
        .post("/api/auth/register/admin")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          name: "Should Not Be Created",
          email: `authz.shouldnotexist.${uniqueId}@example.com`,
          password: "Password123!",
          role: "admin",
        });

      expect(adminRegisterResponse.status).toBe(403);
    } finally {
      await prisma.user.deleteMany({ where: { email: talentEmail } });
    }
  });

  it("allows admin users to register a new admin", async () => {
    const hashedPassword = await bcrypt.hash(adminUser.password, 12);
    await prisma.user.create({
      data: {
        name: adminUser.name,
        email: adminUser.email,
        password: hashedPassword,
        role: "admin",
      },
    });

    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({ email: adminUser.email, password: adminUser.password });

    expect(loginResponse.status).toBe(200);
    const { accessToken } = loginResponse.body.data;

    const adminRegisterResponse = await request(app)
      .post("/api/auth/register/admin")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: adminCreatedUser.name,
        email: adminCreatedUser.email,
        password: adminCreatedUser.password,
        role: "admin",
      });

    expect(adminRegisterResponse.status).toBe(201);
    expect(adminRegisterResponse.body.data.user).toMatchObject({
      name: adminCreatedUser.name,
      email: adminCreatedUser.email,
      role: "admin",
    });
  });
});

describe("Authorization - extended coverage", () => {
  it("forbids client role from accessing POST /api/auth/register/admin", async () => {
    const clientEmail = `authz.client.${uniqueId}@example.com`;

    try {
      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Authz Client",
          email: clientEmail,
          password: "Password123!",
          role: "client",
        });

      expect(registerResponse.status).toBe(201);

      const loginResponse = await request(app)
        .post("/api/auth/login")
        .send({ email: clientEmail, password: "Password123!" });

      expect(loginResponse.status).toBe(200);
      const { accessToken } = loginResponse.body.data;

      const res = await request(app)
        .post("/api/auth/register/admin")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          name: "Should Not Be Created",
          email: `authz.noop.${uniqueId}@example.com`,
          password: "Password123!",
          role: "admin",
        });

      expect(res.status).toBe(403);
    } finally {
      await prisma.user.deleteMany({ where: { email: clientEmail } });
    }
  });

  it("allows admin role to access GET /api/auth/profile", async () => {
    const adminEmail = `authz.admin.profile.${uniqueId}@example.com`;

    try {
      const hashedPassword = await bcrypt.hash("AdminPass123!", 12);
      await prisma.user.create({
        data: {
          name: "Authz Admin Profile",
          email: adminEmail,
          password: hashedPassword,
          role: "admin",
        },
      });

      const loginResponse = await request(app)
        .post("/api/auth/login")
        .send({ email: adminEmail, password: "AdminPass123!" });

      expect(loginResponse.status).toBe(200);
      const { accessToken } = loginResponse.body.data;

      const res = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe(adminEmail);
    } finally {
      await prisma.user.deleteMany({ where: { email: adminEmail } });
    }
  });

  it("rejects GET /internal/users without x-internal-api-key", async () => {
    const res = await request(app).get("/internal/users");

    expect(res.status).toBe(401);
  });

  it("rejects GET /internal/users with wrong x-internal-api-key", async () => {
    const res = await request(app)
      .get("/internal/users")
      .set("x-internal-api-key", "definitely-wrong-key");

    expect(res.status).toBe(401);
  });

  // Test 5 (invalid token → 401) is already covered by the existing
  // "returns 401 when accessing a protected endpoint with an invalid access token" test.

  it("returns 401 when accessing profile with an expired access token", async () => {
    const secret = process.env.JWT_SECRET ?? "test-secret";
    // Sign a structurally valid token with exp already in the past.
    const expiredToken = jwt.sign(
      {
        id: "00000000-0000-0000-0000-000000000000",
        email: "expired@example.com",
        role: "talent" as const,
        exp: Math.floor(Date.now() / 1000) - 60,
      },
      secret,
    );

    const res = await request(app)
      .get("/api/auth/profile")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
  });
});

describe("Internal endpoints", () => {
  let internalUserId: string;
  const internalUserEmail = `internal.test.${uniqueId}@example.com`;
  const internalApiKey = process.env.INTERNAL_API_KEY ?? "test-internal-key";

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash("Password123!", 12);
    const user = await prisma.user.create({
      data: {
        name: "Internal Test User",
        email: internalUserEmail,
        password: hashedPassword,
        role: "talent",
      },
    });
    internalUserId = user.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: internalUserEmail } });
  });

  it("returns user list with valid API key", async () => {
    const res = await request(app)
      .get("/internal/users")
      .set("x-internal-api-key", internalApiKey);

    expect(res.status).toBe(200);
    expect(res.body.data.users).toEqual(expect.any(Array));
    expect(typeof res.body.data.total).toBe("number");
  });

  it("returns a user by ID with valid API key", async () => {
    const res = await request(app)
      .get(`/internal/users/${internalUserId}`)
      .set("x-internal-api-key", internalApiKey);

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(internalUserId);
    expect(res.body.data.user.email).toBe(internalUserEmail);
  });

  it("records and lists talent project completions", async () => {
    const completionDate = new Date().toISOString();
    const projectId = `project-${uniqueId}`;

    const createRes = await request(app)
      .post("/internal/project-completions")
      .set("x-internal-api-key", internalApiKey)
      .send({
        talent_id: internalUserId,
        project_id: projectId,
        token_id: "12",
        ipfs_uri: "ipfs://bafy-test-metadata",
        completion_date: completionDate,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.completion).toMatchObject({
      talentId: internalUserId,
      projectId,
      tokenId: "12",
      ipfsUri: "ipfs://bafy-test-metadata",
    });

    const listRes = await request(app)
      .get(`/internal/talents/${internalUserId}/project-completions`)
      .set("x-internal-api-key", internalApiKey);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.completions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          talentId: internalUserId,
          projectId,
          tokenId: "12",
          ipfsUri: "ipfs://bafy-test-metadata",
        }),
      ]),
    );
  });

  it("returns 404 for a non-existent user ID", async () => {
    const res = await request(app)
      .get("/internal/users/00000000-0000-0000-0000-000000000000")
      .set("x-internal-api-key", internalApiKey);

    expect(res.status).toBe(404);
  });

  it("rejects GET /internal/users/:id without API key", async () => {
    const res = await request(app).get(`/internal/users/${internalUserId}`);

    expect(res.status).toBe(401);
  });

  it("returns 400 when validating token without body", async () => {
    const res = await request(app)
      .post("/internal/validate-token")
      .set("x-internal-api-key", internalApiKey)
      .send({});

    expect(res.status).toBe(400);
  });

  it("returns 401 when validating an invalid token", async () => {
    const res = await request(app)
      .post("/internal/validate-token")
      .set("x-internal-api-key", internalApiKey)
      .send({ token: "garbage.token.value" });

    expect(res.status).toBe(401);
  });

  it("returns 200 when validating a token for an active user", async () => {
    const secret = process.env.JWT_SECRET ?? "test-secret";
    const token = jwt.sign(
      { id: internalUserId, email: internalUserEmail, role: "talent" as const },
      secret,
      { expiresIn: "15m" },
    );

    const res = await request(app)
      .post("/internal/validate-token")
      .set("x-internal-api-key", internalApiKey)
      .send({ token });

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(internalUserId);
  });

  it("returns 401 when validating a token for an inactive user", async () => {
    const inactiveEmail = `internal.inactive.${uniqueId}@example.com`;

    try {
      const hashedPassword = await bcrypt.hash("Password123!", 12);
      const inactiveUser = await prisma.user.create({
        data: {
          name: "Inactive User",
          email: inactiveEmail,
          password: hashedPassword,
          role: "talent",
          isActive: false,
        },
      });

      const secret = process.env.JWT_SECRET ?? "test-secret";
      const token = jwt.sign(
        { id: inactiveUser.id, email: inactiveEmail, role: "talent" as const },
        secret,
        { expiresIn: "15m" },
      );

      const res = await request(app)
        .post("/internal/validate-token")
        .set("x-internal-api-key", internalApiKey)
        .send({ token });

      expect(res.status).toBe(401);
    } finally {
      await prisma.user.deleteMany({ where: { email: inactiveEmail } });
    }
  });
});

describe("Input validation", () => {
  it("rejects public register with role: admin", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Sneaky Admin",
        email: `validation.admin.${uniqueId}@example.com`,
        password: "Password123!",
        role: "admin",
      });

    expect(res.status).toBe(422);
  });

  it("rejects register with password shorter than 8 characters", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Short Pass",
        email: `validation.shortpass.${uniqueId}@example.com`,
        password: "abc",
        role: "talent",
      });

    expect(res.status).toBe(422);
  });

  it("rejects register with invalid email format", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Bad Email",
        email: "not-an-email",
        password: "Password123!",
        role: "talent",
      });

    expect(res.status).toBe(422);
  });

  it("rejects login with wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: testUser.email, password: "WrongPassword!" });

    expect(res.status).toBe(401);
  });

  it("rejects login with non-existent email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: `nonexistent.${uniqueId}@example.com`, password: "Password123!" });

    expect(res.status).toBe(401);
  });

  it("rejects login without required fields", async () => {
    const res = await request(app).post("/api/auth/login").send({});

    expect(res.status).toBe(422);
  });

  it("rejects profile update with password shorter than 8 characters", async () => {
    const email = `validation.updatepass.${uniqueId}@example.com`;

    try {
      await request(app)
        .post("/api/auth/register")
        .send({ name: "Val User", email, password: "Password123!", role: "talent" });

      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email, password: "Password123!" });

      const { accessToken } = loginRes.body.data;

      const res = await request(app)
        .put("/api/auth/profile")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ password: "short" });

      expect(res.status).toBe(422);
    } finally {
      await prisma.user.deleteMany({ where: { email } });
    }
  });

  it("rejects profile update with unsupported skill enum value", async () => {
    const email = `validation.skill.${uniqueId}@example.com`;

    try {
      await request(app)
        .post("/api/auth/register")
        .send({ name: "Skill User", email, password: "Password123!", role: "talent" });

      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email, password: "Password123!" });

      const { accessToken } = loginRes.body.data;

      const res = await request(app)
        .put("/api/auth/profile")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ skills: ["NOT_REAL_SKILL"] });

      expect(res.status).toBe(422);
    } finally {
      await prisma.user.deleteMany({ where: { email } });
    }
  });
});

describe("Business logic edge cases", () => {
  it("returns 400 when refreshing without a token", async () => {
    const res = await request(app).post("/api/auth/refresh").send({});

    expect(res.status).toBe(400);
  });

  it("returns 401 when refreshing with an invalid token", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: "invalid.refresh.token" });

    expect(res.status).toBe(401);
  });

  it("returns 400 when logging out without a refresh token in the body", async () => {
    const email = `bizlogic.logout.${uniqueId}@example.com`;

    try {
      await request(app)
        .post("/api/auth/register")
        .send({ name: "BizLogic User", email, password: "Password123!", role: "talent" });

      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email, password: "Password123!" });

      const { accessToken } = loginRes.body.data;

      const res = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({});

      expect(res.status).toBe(400);
    } finally {
      await prisma.user.deleteMany({ where: { email } });
    }
  });
});

describe("CORS", () => {
  it("allows requests without an Origin header (server-to-server)", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("allows requests from a permitted origin and sets CORS headers", async () => {
    // In test env CORS_ALLOWED_ORIGINS is unset → empty whitelist → non-production fallback allows all
    const res = await request(app)
      .get("/health")
      .set("Origin", "http://localhost:5173");
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("handles preflight OPTIONS request correctly", async () => {
    const res = await request(app)
      .options("/api/auth/login")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "Content-Type,Authorization");
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(res.headers["access-control-allow-methods"]).toBeDefined();
  });
});

describe("Deactivate user", () => {
  let adminToken: string;
  let adminUserId: string;
  let targetUserId: string;
  let targetRefreshToken: string;
  const deactivateAdminEmail = `deactivate.admin.${uniqueId}@example.com`;
  const targetEmail = `deactivate.target.${uniqueId}@example.com`;

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash("Password123!", 12);
    const admin = await prisma.user.create({
      data: { name: "Deactivate Admin", email: deactivateAdminEmail, password: hashedPassword, role: "admin", isActive: true },
    });
    adminUserId = admin.id;

    const adminLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: deactivateAdminEmail, password: "Password123!" });
    adminToken = adminLoginRes.body.data.accessToken;

    await request(app)
      .post("/api/auth/register")
      .send({ name: "Target User", email: targetEmail, password: "Password123!", role: "talent" });

    const targetLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: targetEmail, password: "Password123!" });
    targetUserId = targetLoginRes.body.data.user.id;
    targetRefreshToken = targetLoginRes.body.data.refreshToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [deactivateAdminEmail, targetEmail] } } });
  });

  it("returns 400 when admin tries to deactivate themselves", async () => {
    const res = await request(app)
      .patch(`/api/auth/users/${adminUserId}/deactivate`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it("returns 404 for a non-existent user", async () => {
    const res = await request(app)
      .patch("/api/auth/users/00000000-0000-0000-0000-000000000000/deactivate")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it("returns 403 when a non-admin tries to deactivate", async () => {
    const talentEmail = `deactivate.talent.${uniqueId}@example.com`;
    try {
      await request(app)
        .post("/api/auth/register")
        .send({ name: "Talent", email: talentEmail, password: "Password123!", role: "talent" });
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: talentEmail, password: "Password123!" });
      const talentToken = loginRes.body.data.accessToken;

      const res = await request(app)
        .patch(`/api/auth/users/${targetUserId}/deactivate`)
        .set("Authorization", `Bearer ${talentToken}`);
      expect(res.status).toBe(403);
    } finally {
      await prisma.user.deleteMany({ where: { email: talentEmail } });
    }
  });

  it("returns 200 and sets isActive to false", async () => {
    const res = await request(app)
      .patch(`/api/auth/users/${targetUserId}/deactivate`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.isActive).toBe(false);
  });

  it("deactivated user cannot login", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: targetEmail, password: "Password123!" });
    expect(res.status).toBe(401);
  });

  it("deactivated user's refresh token is revoked", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: targetRefreshToken });
    expect(res.status).toBe(401);
  });
});

describe("Audit logging", () => {
  const auditEmail = `audit.user.${uniqueId}@example.com`;
  const internalApiKey = process.env.INTERNAL_API_KEY ?? "test-internal-key";
  let auditUserId: string;

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { metadata: { path: ["email"], equals: auditEmail } } });
    await prisma.user.deleteMany({ where: { email: auditEmail } });
  });

  it("records a REGISTER event when a user registers", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Audit User", email: auditEmail, password: "Password123!", role: "talent" });
    expect(res.status).toBe(201);
    auditUserId = res.body.data.user.id;

    const logs = await prisma.auditLog.findMany({
      where: { userId: auditUserId, action: "REGISTER" },
    });
    expect(logs.length).toBeGreaterThan(0);
  });

  it("records a LOGIN_SUCCESS event on successful login", async () => {
    await request(app)
      .post("/api/auth/login")
      .send({ email: auditEmail, password: "Password123!" });

    const logs = await prisma.auditLog.findMany({
      where: { userId: auditUserId, action: "LOGIN_SUCCESS" },
    });
    expect(logs.length).toBeGreaterThan(0);
  });

  it("records a LOGIN_FAILED event on wrong password", async () => {
    await request(app)
      .post("/api/auth/login")
      .send({ email: auditEmail, password: "WrongPassword!" });

    const logs = await prisma.auditLog.findMany({
      where: { userId: auditUserId, action: "LOGIN_FAILED" },
    });
    expect(logs.length).toBeGreaterThan(0);
  });

  it("GET /internal/audit-logs returns logs", async () => {
    const res = await request(app)
      .get("/internal/audit-logs")
      .set("x-internal-api-key", internalApiKey);
    expect(res.status).toBe(200);
    expect(res.body.data.logs).toBeInstanceOf(Array);
    expect(res.body.data.total).toBeGreaterThan(0);
  });

  it("GET /internal/audit-logs filters by userId", async () => {
    const res = await request(app)
      .get(`/internal/audit-logs?userId=${auditUserId}`)
      .set("x-internal-api-key", internalApiKey);
    expect(res.status).toBe(200);
    const logs = res.body.data.logs as { userId: string }[];
    expect(logs.every((l) => l.userId === auditUserId)).toBe(true);
  });

  it("GET /internal/audit-logs filters by action", async () => {
    const res = await request(app)
      .get("/internal/audit-logs?action=LOGIN_SUCCESS")
      .set("x-internal-api-key", internalApiKey);
    expect(res.status).toBe(200);
    const logs = res.body.data.logs as { action: string }[];
    expect(logs.every((l) => l.action === "LOGIN_SUCCESS")).toBe(true);
  });
});
