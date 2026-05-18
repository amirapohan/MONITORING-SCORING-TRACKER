import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { prisma as prismaClient } from "../src/models/prisma";

vi.mock("../src/utils/googleOAuth", () => ({
  verifyGoogleIdToken: vi.fn(),
}));

import { verifyGoogleIdToken } from "../src/utils/googleOAuth";

type PrismaClient = typeof prismaClient;

const uniqueId = Date.now();

let app: Express;
let prisma: PrismaClient;

const mockGoogleUser = (overrides?: Partial<{
  subject: string;
  email: string;
  name: string;
  emailVerified: boolean;
}>) => ({
  subject: `google-subject-${uniqueId}`,
  email: `google.oauth.${uniqueId}@gmail.com`,
  name: "Google OAuth User",
  emailVerified: true,
  ...overrides,
});

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret";
  process.env.INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? "test-internal-key";
  process.env.GOOGLE_CLIENT_ID = "test-google-client-id";

  const appModule = await import("../src/app");
  const prismaModule = await import("../src/models/prisma");

  app = appModule.default;
  prisma = prismaModule.prisma;

  await prisma.$connect();
});

afterAll(async () => {
  await prisma.userOAuthAccount.deleteMany({
    where: { providerId: { startsWith: `google-subject-${uniqueId}` } },
  });
  await prisma.user.deleteMany({
    where: { email: { contains: `${uniqueId}` } },
  });
  await prisma.$disconnect();
});

beforeEach(() => {
  vi.mocked(verifyGoogleIdToken).mockReset();
});

describe("Google OAuth - POST /api/auth/google", () => {
  it("returns 422 when idToken is missing", async () => {
    const res = await request(app).post("/api/auth/google").send({});
    expect(res.status).toBe(422);
  });

  it("returns 401 when Google email is not verified", async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValueOnce(
      mockGoogleUser({ emailVerified: false }),
    );

    const res = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "fake-id-token" });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/not verified/i);
  });

  it("returns 401 when Google idToken verification fails", async () => {
    vi.mocked(verifyGoogleIdToken).mockRejectedValueOnce(new Error("invalid token"));

    const res = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "fake-id-token" });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid google idtoken/i);
  });

  it("creates a new user and returns tokens on first Google login", async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValueOnce(mockGoogleUser());

    const res = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "fake-id-token" });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.email).toBe(`google.oauth.${uniqueId}@gmail.com`);
    expect(res.body.data.user.role).toBe("client");

    const oauthAccount = await prisma.userOAuthAccount.findFirst({
      where: { providerId: `google-subject-${uniqueId}` },
    });
    expect(oauthAccount).not.toBeNull();
  });

  it("returns tokens without creating duplicate on repeat Google login", async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValueOnce(mockGoogleUser());

    const res = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "fake-id-token" });

    expect(res.status).toBe(200);

    const userCount = await prisma.user.count({
      where: { email: `google.oauth.${uniqueId}@gmail.com` },
    });
    expect(userCount).toBe(1);
  });

  it("links Google account to existing email-registered user", async () => {
    const existingEmail = `existing.oauth.${uniqueId}@example.com`;
    const differentSubject = `google-subject-${uniqueId}-different`;

    await request(app)
      .post("/api/auth/register")
      .send({ name: "Existing User", email: existingEmail, password: "Password123!", role: "talent" });

    vi.mocked(verifyGoogleIdToken).mockResolvedValueOnce(
      mockGoogleUser({ email: existingEmail, subject: differentSubject }),
    );

    const res = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "fake-id-token" });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(existingEmail);

    const oauthAccount = await prisma.userOAuthAccount.findFirst({
      where: { providerId: differentSubject },
    });
    expect(oauthAccount).not.toBeNull();
  });

  it("returns 401 when the user account is inactive", async () => {
    const inactiveEmail = `inactive.oauth.${uniqueId}@gmail.com`;
    const inactiveSubject = `google-subject-${uniqueId}-inactive`;

    await prisma.user.create({
      data: { name: "Inactive OAuth User", email: inactiveEmail, isActive: false, role: "client" },
    });

    vi.mocked(verifyGoogleIdToken).mockResolvedValueOnce(
      mockGoogleUser({ email: inactiveEmail, subject: inactiveSubject }),
    );

    const res = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "fake-id-token" });

    expect(res.status).toBe(401);
  });

  it("records a LOGIN_SUCCESS audit log with provider=google", async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValueOnce(mockGoogleUser());

    const res = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "fake-id-token" });

    expect(res.status).toBe(200);

    const userId = res.body.data.user.id;
    const logs = await prisma.auditLog.findMany({
      where: { userId, action: "LOGIN_SUCCESS" },
    });

    const googleLog = logs.find(
      (l) => (l.metadata as { provider?: string } | null)?.provider === "google",
    );
    expect(googleLog).toBeDefined();
  });
});
