import type { Prisma, User, UserOAuthAccount } from "@prisma/client";

import { prisma } from "../models/prisma";

type OAuthAccountWithUser = UserOAuthAccount & {
  user: User;
};

export const userOAuthAccountRepository = {
  findByProviderAccount: (
    provider: string,
    providerId: string,
  ): Promise<OAuthAccountWithUser | null> =>
    prisma.userOAuthAccount.findUnique({
      where: {
        provider_providerId: {
          provider,
          providerId,
        },
      },
      include: { user: true },
    }),

  findByUserAndProvider: (
    userId: string,
    provider: string,
  ): Promise<UserOAuthAccount | null> =>
    prisma.userOAuthAccount.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    }),

  create: (data: Prisma.UserOAuthAccountCreateInput): Promise<UserOAuthAccount> =>
    prisma.userOAuthAccount.create({ data }),
};
