import type { NextFunction, Request, Response } from "express";

import { tokenBlacklistRepository } from "../repositories/tokenBlacklist.repository";
import { verifyAccessToken } from "../utils/jwt";

const checkBlacklist = async (
  jti: string,
  userId: string,
): Promise<"revoked" | "deactivated" | null> => {
  try {
    if (await tokenBlacklistRepository.isTokenBlacklisted(jti)) return "revoked";
    if (await tokenBlacklistRepository.isUserDeactivated(userId)) return "deactivated";
    return null;
  } catch {
    // Redis unavailable: fail-open, skip blacklist check
    console.error("[authenticate] Redis unavailable, skipping blacklist check");
    return null;
  }
};

const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: No token provided",
      });
      return;
    }

    const token = authHeader.split(" ")[1];
    const payload = verifyAccessToken(token);

    const blacklistStatus = await checkBlacklist(payload.jti, payload.id);
    if (blacklistStatus === "revoked") {
      res.status(401).json({ success: false, message: "Unauthorized: Token has been revoked" });
      return;
    }
    if (blacklistStatus === "deactivated") {
      res.status(401).json({ success: false, message: "Unauthorized: Account has been deactivated" });
      return;
    }

    req.user = payload;
    next();
  } catch {
    res.status(401).json({
      success: false,
      message: "Unauthorized: Invalid or expired token",
    });
  }
};

export default authenticate;
