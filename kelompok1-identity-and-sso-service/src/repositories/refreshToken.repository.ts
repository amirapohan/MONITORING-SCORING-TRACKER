import type { RefreshToken } from "@prisma/client";

import { prisma } from "../models/prisma";
import type { Db } from "./types";

export const refreshTokenRepository = {
  create: (
    params: { userId: string; token: string; expiresAt: Date },
    db: Db = prisma,
  ): Promise<RefreshToken> =>
    (db as typeof prisma).refreshToken.create({ data: params }),

  findByTokenAndUser: (
    token: string,
    userId: string,
  ): Promise<RefreshToken | null> =>
    prisma.refreshToken.findFirst({ where: { token, userId } }),

  deleteByToken: (token: string, db: Db = prisma) =>
    (db as typeof prisma).refreshToken.deleteMany({ where: { token } }),

  deleteAllByUserId: (userId: string, db: Db = prisma) =>
    (db as typeof prisma).refreshToken.deleteMany({ where: { userId } }),
};
