import { config } from "../config";
import { refreshTokenRepository } from "../repositories/refreshToken.repository";
import { userOAuthAccountRepository } from "../repositories/userOAuthAccount.repository";
import { userRepository } from "../repositories/user.repository";
import type { AppRole, RequestContext, SafeUser } from "../types/auth";
import {
  BadRequestError,
  ConflictError,
  UnauthorizedError,
} from "../types/errors";
import { logAuditEvent } from "../utils/audit";
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

    const oauthAccount = await userOAuthAccountRepository.findByProviderAccount(
      GOOGLE_PROVIDER,
      googleUser.subject,
    );
    const existing = oauthAccount?.user ?? (await userRepository.findByEmail(googleUser.email));
    let user;

    if (!existing) {
      user = await userRepository.create({
        name: googleUser.name,
        email: googleUser.email,
        role: resolveOAuthRole(googleUser.email),
      });
      await userOAuthAccountRepository.create({
        user: { connect: { id: user.id } },
        provider: GOOGLE_PROVIDER,
        providerId: googleUser.subject,
      });
    } else if (!oauthAccount) {
      const linkedGoogleAccount = await userOAuthAccountRepository.findByUserAndProvider(
        existing.id,
        GOOGLE_PROVIDER,
      );
      if (linkedGoogleAccount) {
        throw new ConflictError("Email is already linked to another Google account");
      }

      user = await userRepository.update(existing.id, {
        name: existing.name || googleUser.name,
      });
      await userOAuthAccountRepository.create({
        user: { connect: { id: user.id } },
        provider: GOOGLE_PROVIDER,
        providerId: googleUser.subject,
      });
    } else {
      user = existing;
    }

    if (!user.isActive) {
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

    await logAuditEvent({
      action: "LOGIN_SUCCESS",
      userId: user.id,
      ...ctx,
      metadata: { provider: GOOGLE_PROVIDER },
    });

    return { accessToken, refreshToken, user: stripPassword(user) };
  },
};
