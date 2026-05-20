import type { Prisma, TalentProjectCompletion } from "@prisma/client";

import { prisma } from "../models/prisma";
import type { Db } from "./types";

export const talentProjectCompletionRepository = {
  create: (
    data: Prisma.TalentProjectCompletionCreateInput,
    db: Db = prisma,
  ): Promise<TalentProjectCompletion> =>
    (db as typeof prisma).talentProjectCompletion.create({ data }),

  findByTalentAndProject: (
    talentId: string,
    projectId: string,
  ): Promise<TalentProjectCompletion | null> =>
    prisma.talentProjectCompletion.findUnique({
      where: { talentId_projectId: { talentId, projectId } },
    }),

  findManyByTalentId: (talentId: string): Promise<TalentProjectCompletion[]> =>
    prisma.talentProjectCompletion.findMany({
      where: { talentId },
      orderBy: { completionDate: "desc" },
    }),
};
