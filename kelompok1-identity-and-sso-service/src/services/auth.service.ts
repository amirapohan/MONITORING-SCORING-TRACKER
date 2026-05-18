import type { TalentProjectCompletion } from "@prisma/client";
import bcrypt from "bcryptjs";

import jwt from "jsonwebtoken";

import { config } from "../config";
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
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";
import { parseExpiresToMs } from "../utils/time";
import { logAuditEvent } from "../utils/audit";
import { stripPassword } from "../utils/user";

type RegisterInput = {
  name: string;
  email: string;
  password: string;
  role?: AppRole;
};

type LoginInput = {
  email: string;
  password: string;
};

type UpdateProfileInput = {
  name?: string;
  password?: string;
};

type ProfileResponse = SafeUser & {
  projectCompletions: TalentProjectCompletion[];
};

const log = logAuditEvent;

export const authService = {
  async register(input: RegisterInput, ctx?: RequestContext): Promise<SafeUser> {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw new ConflictError("Email already registered");
    }

    const hashedPassword = await bcrypt.hash(input.password, 12);
    const user = await userRepository.create({
      name: input.name,
      email: input.email,
      password: hashedPassword,
      role: input.role ?? "talent",
    });

    await log({ action: "REGISTER", userId: user.id, ...ctx, metadata: { role: user.role } });

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
      await log({ action: "LOGIN_FAILED", ...ctx, metadata: { email: input.email } });
      throw new UnauthorizedError("Invalid credentials or account is inactive");
    }

    const isMatch = await bcrypt.compare(input.password, user.password);
    if (!isMatch) {
      await log({ action: "LOGIN_FAILED", userId: user.id, ...ctx, metadata: { email: input.email } });
      throw new UnauthorizedError("Invalid credentials or account is inactive");
    }

    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = generateRefreshToken({ id: user.id });

    await refreshTokenRepository.create({
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + parseExpiresToMs(config.jwt.refreshExpiresIn)),
    });

    await log({ action: "LOGIN_SUCCESS", userId: user.id, ...ctx });

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

    await log({ action: "TOKEN_REFRESH", userId: user.id, ...ctx });

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

    await refreshTokenRepository.deleteByToken(refreshToken);
    await log({ action: "LOGOUT", userId, ...ctx });
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
    await refreshTokenRepository.deleteAllByUserId(targetId);
    const updated = await userRepository.update(targetId, { isActive: false });

    // Mark in Redis so existing access tokens are rejected immediately
    const accessTokenTtl = Math.ceil(
      parseExpiresToMs(config.jwt.accessExpiresIn) / 1000,
    );
    await tokenBlacklistRepository.addDeactivatedUser(targetId, accessTokenTtl);

    await log({
      action: "USER_DEACTIVATED",
      userId: adminId,
      ...ctx,
      metadata: { targetUserId: targetId, targetEmail: user.email },
    });

    return stripPassword(updated);
  },

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<SafeUser> {
    const existing = await userRepository.findById(userId);
    if (!existing) {
      throw new NotFoundError("User not found");
    }

    const data: { name?: string; password?: string } = {};
    if (input.name) {
      data.name = input.name;
    }
    if (input.password) {
      data.password = await bcrypt.hash(input.password, 12);
    }

    const updated = await userRepository.update(userId, data);
    return stripPassword(updated);
  },
};
