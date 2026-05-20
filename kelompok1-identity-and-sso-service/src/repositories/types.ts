import type { PrismaClient, Prisma } from "@prisma/client";

export type Db = PrismaClient | Prisma.TransactionClient;
