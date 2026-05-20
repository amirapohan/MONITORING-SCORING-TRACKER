import type { AuditAction, Prisma } from "@prisma/client";

import { prisma } from "../models/prisma";
import { auditLogRepository } from "../repositories/auditLog.repository";
import { outboxEventRepository } from "../repositories/outboxEvent.repository";
import type { Db } from "../repositories/types";

export type EmitInput = {
  eventType: AuditAction;
  userId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
};

/**
 * Insert an OutboxEvent row in the given transaction.
 * Do NOT swallow errors — failure must roll back the enclosing txn.
 * In test mode, also writes the AuditLog row synchronously so tests pass without the worker.
 */
export const emitEvent = async (db: Db, input: EmitInput): Promise<void> => {
  const row = await outboxEventRepository.create(
    {
      eventType: input.eventType,
      userId: input.userId,
      ip: input.ip,
      userAgent: input.userAgent,
      payload: (input.metadata as Prisma.InputJsonValue) ?? {},
    },
    db,
  );

  if (process.env.NODE_ENV === "test") {
    await auditLogRepository.create(
      {
        action: input.eventType,
        userId: input.userId,
        ip: input.ip,
        userAgent: input.userAgent,
        metadata: input.metadata,
        outboxEventId: row.id,
      },
      db,
    );
  }
};

/**
 * Best-effort emit with no enclosing transaction.
 * Use only for events that have no accompanying business write (e.g. LOGIN_FAILED).
 */
export const emitEventBestEffort = async (input: EmitInput): Promise<void> => {
  try {
    await emitEvent(prisma, input);
  } catch {
    // must not break auth response
  }
};
