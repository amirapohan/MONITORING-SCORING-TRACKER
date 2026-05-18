import type { NextFunction, Request, Response } from "express";

import { googleAuthService } from "../services/googleAuth.service";

export const googleAuthController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await googleAuthService.login(req.body?.idToken, {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return res.status(200).json({
        success: true,
        message: "Google login successful",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
};
