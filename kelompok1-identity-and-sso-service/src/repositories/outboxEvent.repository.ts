import type { AuditAction, OutboxEvent, Prisma } from "@prisma/client";

import { prisma } from "../models/prisma";
import type { Db } from "./types";

type CreateInput = {
  eventType: AuditAction;
  userId?: string;
  ip?: string;
  userAgent?: string;
  payload: Prisma.InputJsonValue;
};

export const outboxEventRepository = {
  create: (data: CreateInput, db: Db = prisma): Promise<OutboxEvent> =>
    (db as typeof prisma).outboxEvent.create({ data }),

  findUnpublished: (limit = 100): Promise<OutboxEvent[]> =>
    prisma.outboxEvent.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: "asc" },
      take: limit,
    }),

  markPublished: (id: string): Promise<OutboxEvent> =>
    prisma.outboxEvent.update({
      where: { id },
      data: { publishedAt: new Date() },
    }),
};
