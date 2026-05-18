import type { Prisma, User } from "@prisma/client";

import { prisma } from "../models/prisma";

export const userRepository = {
  findByEmail: (email: string): Promise<User | null> =>
    prisma.user.findUnique({ where: { email } }),

  findById: (id: string): Promise<User | null> =>
    prisma.user.findUnique({ where: { id } }),

  findByIdWithProjectCompletions: (id: string) =>
    prisma.user.findUnique({
      where: { id },
      include: {
        projectCompletions: {
          orderBy: { completionDate: "desc" },
        },
      },
    }),

  create: (data: Prisma.UserCreateInput): Promise<User> =>
    prisma.user.create({ data }),

  update: (id: string, data: Prisma.UserUpdateInput): Promise<User> =>
    prisma.user.update({ where: { id }, data }),

  findMany: (): Promise<User[]> => prisma.user.findMany(),
};
