import { config } from "../config";
import { prisma } from "../models/prisma";
import { refreshTokenRepository } from "../repositories/refreshToken.repository";
import { userOAuthAccountRepository } from "../repositories/userOAuthAccount.repository";
import { userRepository } from "../repositories/user.repository";
import type { AppRole, RequestContext, SafeUser } from "../types/auth";
import {
  BadRequestError,
  ConflictError,
  UnauthorizedError,
} from "../types/errors";
import { emitEvent } from "../utils/events";
import { verifyGoogleIdToken } from "../utils/googleOAuth";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt";
import { parseExpiresToMs } from "../utils/time";
import { stripPassword } from "../utils/user";

const resolveOAuthRole = (_email: string): AppRole => "client";
const GOOGLE_PROVIDER = "google";

export const googleAuthService = {
  async login(
    idToken: string | undefined,
    ctx?: RequestContext,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: SafeUser;
  }> {
    if (!idToken) {
      throw new BadRequestError("Google idToken is required");
    }

    let googleUser;
    try {
      googleUser = await verifyGoogleIdToken(idToken);
    } catch {
      throw new UnauthorizedError("Invalid Google idToken");
    }

    if (!googleUser.emailVerified) {
      throw new UnauthorizedError("Google account email is not verified");
    }

    // All reads + conflict checks before opening the transaction
    const oauthAccount = await userOAuthAccountRepository.findByProviderAccount(
      GOOGLE_PROVIDER,
      googleUser.subject,
    );
    const existing = oauthAccount?.user ?? (await userRepository.findByEmail(googleUser.email));

    if (existing && !oauthAccount) {
      const linkedGoogleAccount = await userOAuthAccountRepository.findByUserAndProvider(
        existing.id,
        GOOGLE_PROVIDER,
      );
      if (linkedGoogleAccount) {
        throw new ConflictError("Email is already linked to another Google account");
      }
    }

    if (existing && !existing.isActive) {
      throw new UnauthorizedError("Invalid credentials or account is inactive");
    }

    const accessToken_gen = (user: { id: string; name: string; email: string; role: AppRole }) =>
      generateAccessToken({ id: user.id, name: user.name, email: user.email, role: user.role });
    const refreshTokenValue = generateRefreshToken({ id: existing?.id ?? "pending" });

    // One transaction: all writes + outbox insert
    const user = await prisma.$transaction(async (tx) => {
      let u;
      if (!existing) {
        u = await userRepository.create(
          { name: googleUser.name, email: googleUser.email, role: resolveOAuthRole(googleUser.email) },
          tx,
        );
        await userOAuthAccountRepository.create(
          { user: { connect: { id: u.id } }, provider: GOOGLE_PROVIDER, providerId: googleUser.subject },
          tx,
        );
      } else if (!oauthAccount) {
        u = await userRepository.update(
          existing.id,
          { name: existing.name || googleUser.name },
          tx,
        );
        await userOAuthAccountRepository.create(
          { user: { connect: { id: u.id } }, provider: GOOGLE_PROVIDER, providerId: googleUser.subject },
          tx,
        );
      } else {
        u = existing;
      }

      const finalRefreshToken = generateRefreshToken({ id: u.id });
      await refreshTokenRepository.create(
        {
          userId: u.id,
          token: finalRefreshToken,
          expiresAt: new Date(Date.now() + parseExpiresToMs(config.jwt.refreshExpiresIn)),
        },
        tx,
      );
      await emitEvent(tx, {
        eventType: "LOGIN_SUCCESS",
        userId: u.id,
        ...ctx,
        metadata: { provider: GOOGLE_PROVIDER },
      });

      return { user: u, refreshToken: finalRefreshToken };
    });

    if (!user.user.isActive) {
      throw new UnauthorizedError("Invalid credentials or account is inactive");
    }

    const accessToken = accessToken_gen(user.user);

    return {
      accessToken,
      refreshToken: user.refreshToken,
      user: stripPassword(user.user),
    };
  },
};
