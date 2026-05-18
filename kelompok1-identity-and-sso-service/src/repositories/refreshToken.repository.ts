import type { RefreshToken } from "@prisma/client";

import { prisma } from "../models/prisma";

export const refreshTokenRepository = {
  create: (params: {
    userId: string;
    token: string;
    expiresAt: Date;
  }): Promise<RefreshToken> =>
    prisma.refreshToken.create({
      data: params,
    }),

  findByTokenAndUser: (
    token: string,
    userId: string,
  ): Promise<RefreshToken | null> =>
    prisma.refreshToken.findFirst({
      where: { token, userId },
    }),

  deleteByToken: (token: string) =>
    prisma.refreshToken.deleteMany({ where: { token } }),

  deleteAllByUserId: (userId: string) =>
    prisma.refreshToken.deleteMany({ where: { userId } }),
};
