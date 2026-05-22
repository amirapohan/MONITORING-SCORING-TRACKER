import type { AuditAction, AuditLog, TalentProjectCompletion } from "@prisma/client";

import { prisma } from "../models/prisma";
import { auditLogRepository } from "../repositories/auditLog.repository";
import { talentProjectCompletionRepository } from "../repositories/talentProjectCompletion.repository";
import { userRepository } from "../repositories/user.repository";
import type { JwtPayload, SafeUser } from "../types/auth";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from "../types/errors";
import { emitEvent } from "../utils/events";
import { verifyAccessToken } from "../utils/jwt";
import { stripPassword } from "../utils/user";

type ProjectCompletionInput = {
  talent_id: string;
  project_id: string;
  token_id: string;
  ipfs_uri: string;
  completion_date: string;
};

export const internalService = {
  async getUser(id: string): Promise<SafeUser> {
    const user = await userRepository.findById(id);
    if (!user) {
      throw new NotFoundError("User not found");
    }
    return stripPassword(user);
  },

  async listUsers(): Promise<{ users: SafeUser[]; total: number }> {
    const users = await userRepository.findMany();
    const safe = users.map(stripPassword);
    return { users: safe, total: safe.length };
  },

  async validateToken(token: string | undefined): Promise<JwtPayload> {
    if (!token) {
      throw new BadRequestError("Token is required");
    }

    let payload: JwtPayload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new UnauthorizedError("Invalid or expired token");
    }

    const user = await userRepository.findById(payload.id);
    if (!user || !user.isActive) {
      throw new UnauthorizedError("User not found or inactive");
    }

    return payload;
  },

  async listAuditLogs(params?: {
    userId?: string;
    action?: AuditAction;
    limit?: number;
  }): Promise<{ logs: AuditLog[]; total: number }> {
    const logs = await auditLogRepository.findMany(params);
    return { logs, total: logs.length };
  },

  async createProjectCompletion(
    input: ProjectCompletionInput,
  ): Promise<TalentProjectCompletion> {
    const talent = await userRepository.findById(input.talent_id);
    if (!talent) {
      throw new NotFoundError("Talent not found");
    }
    if (talent.role !== "talent") {
      throw new BadRequestError("User is not a talent");
    }
    if (!talent.isActive) {
      throw new BadRequestError("Talent is inactive");
    }

    const completionDate = new Date(input.completion_date);
    if (Number.isNaN(completionDate.getTime())) {
      throw new BadRequestError("completion_date must be a valid ISO date");
    }

    const existing = await talentProjectCompletionRepository.findByTalentAndProject(
      input.talent_id,
      input.project_id,
    );
    if (existing) {
      throw new ConflictError("Project completion already exists");
    }

    const completion = await prisma.$transaction(async (tx) => {
      const c = await talentProjectCompletionRepository.create(
        {
          talent: { connect: { id: input.talent_id } },
          projectId: input.project_id,
          tokenId: input.token_id,
          ipfsUri: input.ipfs_uri,
          completionDate,
        },
        tx,
      );
      await emitEvent(tx, {
        eventType: "PROJECT_COMPLETED",
        userId: input.talent_id,
        metadata: {
          projectId: input.project_id,
          tokenId: input.token_id,
          ipfsUri: input.ipfs_uri,
          completionDate: completionDate.toISOString(),
        },
      });
      return c;
    });

    return completion;
  },

  async listProjectCompletions(
    talentId: string,
  ): Promise<{ completions: TalentProjectCompletion[]; total: number }> {
    const completions = await talentProjectCompletionRepository.findManyByTalentId(talentId);
    return { completions, total: completions.length };
  },
};
