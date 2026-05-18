import type { Prisma } from "@prisma/client";

import { auditLogRepository } from "../repositories/auditLog.repository";

export const logAuditEvent = async (
  data: Parameters<typeof auditLogRepository.create>[0] & {
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> => {
  try {
    await auditLogRepository.create(data);
  } catch {
    // audit log failure must not break auth flows
  }
};
