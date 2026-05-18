import type { Prisma, TalentProjectCompletion } from "@prisma/client";

import { prisma } from "../models/prisma";

export const talentProjectCompletionRepository = {
  create: (
    data: Prisma.TalentProjectCompletionCreateInput,
  ): Promise<TalentProjectCompletion> => prisma.talentProjectCompletion.create({ data }),

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
