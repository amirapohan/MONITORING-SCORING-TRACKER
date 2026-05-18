import type { AuditAction, Prisma } from "@prisma/client";

import { prisma } from "../models/prisma";

export const auditLogRepository = {
  create: (data: {
    action: AuditAction;
    userId?: string;
    ip?: string;
    userAgent?: string;
    metadata?: Prisma.InputJsonValue;
  }) => prisma.auditLog.create({ data }),

  findMany: (params?: { userId?: string; action?: AuditAction; limit?: number }) =>
    prisma.auditLog.findMany({
      where: {
        ...(params?.userId && { userId: params.userId }),
        ...(params?.action && { action: params.action }),
      },
      orderBy: { createdAt: "desc" },
      take: params?.limit ?? 100,
    }),
};
