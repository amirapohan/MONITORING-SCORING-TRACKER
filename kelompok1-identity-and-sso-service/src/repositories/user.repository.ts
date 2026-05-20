import type { Prisma, User } from "@prisma/client";

import { prisma } from "../models/prisma";
import type { Db } from "./types";

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

  create: (data: Prisma.UserCreateInput, db: Db = prisma): Promise<User> =>
    (db as typeof prisma).user.create({ data }),

  update: (id: string, data: Prisma.UserUpdateInput, db: Db = prisma): Promise<User> =>
    (db as typeof prisma).user.update({ where: { id }, data }),

  findMany: (): Promise<User[]> => prisma.user.findMany(),
};
