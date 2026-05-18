import type { AuditAction } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";

import { internalService } from "../services/internal.service";

export const internalController = {
  async getUser(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await internalService.getUser(String(req.params.id));
      return res.status(200).json({
        success: true,
        message: "User found",
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  },

  async listUsers(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await internalService.listUsers();
      return res.status(200).json({
        success: true,
        message: "Users retrieved",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async validateToken(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = await internalService.validateToken(req.body?.token);
      return res.status(200).json({
        success: true,
        message: "Token is valid",
        data: { user: payload },
      });
    } catch (error) {
      next(error);
    }
  },

  async listAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, action, limit } = req.query;
      const result = await internalService.listAuditLogs({
        userId: userId ? String(userId) : undefined,
        action: action ? (String(action) as AuditAction) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      return res.status(200).json({
        success: true,
        message: "Audit logs retrieved",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async createProjectCompletion(req: Request, res: Response, next: NextFunction) {
    try {
      const completion = await internalService.createProjectCompletion(req.body);
      return res.status(201).json({
        success: true,
        message: "Project completion recorded",
        data: { completion },
      });
    } catch (error) {
      next(error);
    }
  },

  async listProjectCompletions(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await internalService.listProjectCompletions(String(req.params.talentId));
      return res.status(200).json({
        success: true,
        message: "Project completions retrieved",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
};
