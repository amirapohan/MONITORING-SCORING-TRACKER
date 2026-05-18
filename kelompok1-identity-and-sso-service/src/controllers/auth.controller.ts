import type { NextFunction, Request, Response } from "express";

import { authService } from "../services/auth.service";

const ctx = (req: Request) => ({
  ip: req.ip,
  userAgent: req.headers["user-agent"],
});

export const authController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await authService.register(req.body, ctx(req));
      return res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body, ctx(req));
      return res.status(200).json({
        success: true,
        message: "Login successful",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.refreshAccessToken(req.body?.refreshToken, ctx(req));
      return res.status(200).json({
        success: true,
        message: "Access token refreshed",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const accessToken = req.headers.authorization?.split(" ")[1];
      await authService.logout(req.body?.refreshToken, accessToken, ctx(req));
      return res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await authService.getProfile(req.user!.id);
      return res.status(200).json({
        success: true,
        message: "Profile retrieved successfully",
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  },

  async deactivateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await authService.deactivateUser(req.user!.id, String(req.params.id), ctx(req));
      return res.status(200).json({
        success: true,
        message: "User deactivated successfully",
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  },

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await authService.updateProfile(req.user!.id, req.body);
      return res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  },
};
