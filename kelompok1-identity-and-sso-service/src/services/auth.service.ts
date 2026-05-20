import type { Prisma, TalentProjectCompletion } from "@prisma/client";
import bcrypt from "bcryptjs";

import jwt from "jsonwebtoken";

import { config } from "../config";
import { prisma } from "../models/prisma";
import { refreshTokenRepository } from "../repositories/refreshToken.repository";
import { tokenBlacklistRepository } from "../repositories/tokenBlacklist.repository";
import { userRepository } from "../repositories/user.repository";
import type { AppRole, RequestContext, SafeUser } from "../types/auth";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from "../types/errors";
import {
  uniqueSkillValues,
  type SkillValue,
  type SubSkillValue,
} from "../types/skills";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";
import { emitEvent, emitEventBestEffort } from "../utils/events";
import { parseExpiresToMs } from "../utils/time";
import { stripPassword } from "../utils/user";

type RegisterInput = {
  name: string;
  email: string;
  password: string;
  role?: AppRole;
  skills?: SkillValue[];
  subSkills?: SubSkillValue[];
};

type LoginInput = {
  email: string;
  password: string;
};

type UpdateProfileInput = {
  name?: string;
  password?: string;
  skills?: SkillValue[];
  subSkills?: SubSkillValue[];
};

type ProfileResponse = SafeUser & {
  projectCompletions: TalentProjectCompletion[];
};

export const authService = {
  async register(input: RegisterInput, ctx?: RequestContext): Promise<SafeUser> {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw new ConflictError("Email already registered");
    }

    const hashedPassword = await bcrypt.hash(input.password, 12);

    let user;
    try {
      user = await prisma.$transaction(async (tx) => {
        const created = await userRepository.create(
          {
            name: input.name,
            email: input.email,
            password: hashedPassword,
            role: input.role ?? "talent",
            skills: uniqueSkillValues(input.skills),
            subSkills: uniqueSkillValues(input.subSkills),
          },
          tx,
        );
        await emitEvent(tx, {
          eventType: "REGISTER",
          userId: created.id,
          ...ctx,
          metadata: { role: created.role },
        });
        return created;
      });
    } catch (err) {
      if (
        err instanceof Error &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        throw new ConflictError("Email already registered");
      }
      throw err;
    }

    return stripPassword(user);
  },

  async login(
    input: LoginInput,
    ctx?: RequestContext,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: SafeUser;
  }> {
    const user = await userRepository.findByEmail(input.email);

    if (!user || !user.isActive || !user.password) {
      await emitEventBestEffort({
        eventType: "LOGIN_FAILED",
        ...ctx,
        metadata: { email: input.email },
      });
      throw new UnauthorizedError("Invalid credentials or account is inactive");
    }

    const isMatch = await bcrypt.compare(input.password, user.password);
    if (!isMatch) {
      await emitEventBestEffort({
        eventType: "LOGIN_FAILED",
        userId: user.id,
        ...ctx,
        metadata: { email: input.email },
      });
      throw new UnauthorizedError("Invalid credentials or account is inactive");
    }

    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = generateRefreshToken({ id: user.id });

    await prisma.$transaction(async (tx) => {
      await refreshTokenRepository.create(
        {
          userId: user.id,
          token: refreshToken,
          expiresAt: new Date(Date.now() + parseExpiresToMs(config.jwt.refreshExpiresIn)),
        },
        tx,
      );
      await emitEvent(tx, { eventType: "LOGIN_SUCCESS", userId: user.id, ...ctx });
    });

    return { accessToken, refreshToken, user: stripPassword(user) };
  },

  async refreshAccessToken(
    token: string | undefined,
    ctx?: RequestContext,
  ): Promise<{ accessToken: string }> {
    if (!token) {
      throw new BadRequestError("Refresh token is required");
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    const stored = await refreshTokenRepository.findByTokenAndUser(token, decoded.id);
    if (!stored || new Date() > stored.expiresAt) {
      throw new UnauthorizedError("Refresh token not found or expired");
    }

    const user = await userRepository.findById(decoded.id);
    if (!user || !user.isActive) {
      throw new UnauthorizedError("User not found or inactive");
    }

    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    await emitEventBestEffort({ eventType: "TOKEN_REFRESH", userId: user.id, ...ctx });

    return { accessToken };
  },

  async logout(
    refreshToken: string | undefined,
    accessToken?: string,
    ctx?: RequestContext,
  ): Promise<void> {
    if (!refreshToken) {
      throw new BadRequestError("Refresh token is required");
    }

    // Redis blacklist before the DB txn — safe order: if txn fails, worst case
    // the access token is blacklisted in Redis but refresh row still exists.
    if (accessToken) {
      const decoded = jwt.decode(accessToken) as { exp?: number; jti?: string } | null;
      const now = Math.floor(Date.now() / 1000);
      const ttl = decoded?.exp ? decoded.exp - now : 0;
      if (decoded?.jti) {
        await tokenBlacklistRepository.addToken(decoded.jti, ttl);
      }
    }

    let userId: string | undefined;
    try {
      const decoded = verifyRefreshToken(refreshToken);
      userId = decoded.id;
    } catch {
      // token may be invalid but we still delete it
    }

    await prisma.$transaction(async (tx) => {
      await refreshTokenRepository.deleteByToken(refreshToken, tx);
      await emitEvent(tx, { eventType: "LOGOUT", userId, ...ctx });
    });
  },

  async getProfile(userId: string): Promise<ProfileResponse> {
    const user = await userRepository.findByIdWithProjectCompletions(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }
    return {
      ...stripPassword(user),
      projectCompletions: user.projectCompletions,
    };
  },

  async deactivateUser(
    adminId: string,
    targetId: string,
    ctx?: RequestContext,
  ): Promise<SafeUser> {
    if (adminId === targetId) {
      throw new BadRequestError("Cannot deactivate your own account");
    }
    const user = await userRepository.findById(targetId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const updated = await prisma.$transaction(async (tx) => {
      await refreshTokenRepository.deleteAllByUserId(targetId, tx);
      const u = await userRepository.update(targetId, { isActive: false }, tx);
      await emitEvent(tx, {
        eventType: "USER_DEACTIVATED",
        userId: adminId,
        ...ctx,
        metadata: { targetUserId: targetId, targetEmail: user.email },
      });
      return u;
    });

    // Mark in Redis AFTER commit — if Redis fails, user is deactivated in DB
    // and refresh tokens are revoked, so damage is contained.
    const accessTokenTtl = Math.ceil(
      parseExpiresToMs(config.jwt.accessExpiresIn) / 1000,
    );
    await tokenBlacklistRepository.addDeactivatedUser(targetId, accessTokenTtl);

    return stripPassword(updated);
  },

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<SafeUser> {
    const existing = await userRepository.findById(userId);
    if (!existing) {
      throw new NotFoundError("User not found");
    }

    const data: Prisma.UserUpdateInput = {};
    if (input.name) {
      data.name = input.name;
    }
    if (input.password) {
      data.password = await bcrypt.hash(input.password, 12);
    }
    if (input.skills) {
      data.skills = uniqueSkillValues(input.skills);
    }
    if (input.subSkills) {
      data.subSkills = uniqueSkillValues(input.subSkills);
    }

    const updated = await userRepository.update(userId, data);
    return stripPassword(updated);
  },
};
