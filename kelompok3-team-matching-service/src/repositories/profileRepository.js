const prisma = require('../core/prisma');

async function getProfileSkills(studentId, period) {
  const entry = await prisma.poolEntry.findFirst({
    where: { studentId, period, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      sdgTopics: true,
      talentSkills: {
        where: { period },
        select: { skillName: true, skillLevel: true },
      },
    },
  });

  if (!entry) throw { status: 404, message: 'profile_not_found' };

  const skills = {};
  entry.talentSkills.forEach((s) => { skills[s.skillName] = s.skillLevel; });

  return { sdg_topics: entry.sdgTopics, skills };
}

async function updateProfileSkills(studentId, period, skills, sdgTopics) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.poolEntry.updateMany({
      where: { studentId, period, deletedAt: null },
      data: { sdgTopics },
    });

    if (updated.count === 0) {
      throw { status: 404, message: 'profile_not_found', detail: 'Mahasiswa tidak ditemukan di pool' };
    }

    await tx.talentSkill.deleteMany({ where: { studentId, period } });

    if (skills && typeof skills === 'object') {
      const entries = Object.entries(skills);
      if (entries.length > 0) {
        await tx.talentSkill.createMany({
          data: entries.map(([skillName, skillLevel]) => ({
            studentId,
            skillName: String(skillName).toLowerCase(),
            skillLevel: parseInt(skillLevel) || 1,
            period,
          })),
        });
      }
    }

    return { skills, sdg_topics: sdgTopics };
  });
}

module.exports = { getProfileSkills, updateProfileSkills };
