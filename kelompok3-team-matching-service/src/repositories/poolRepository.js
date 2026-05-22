const prisma = require('../core/prisma');

// ── Transform helper ───────────────────────────────────────────────────────

function toPoolEntry(p) {
  if (!p) return null;
  return {
    id: p.id,
    student_id: p.studentId,
    student_name: p.studentName,
    program_studi: p.programStudi,
    sdg_topics: p.sdgTopics,
    availability: p.availability,
    notes: p.notes,
    status: p.status,
    period: p.period,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
    deleted_at: p.deletedAt,
  };
}

// ── Reads ──────────────────────────────────────────────────────────────────

async function findEntry(studentId, period) {
  const entry = await prisma.poolEntry.findFirst({
    where: { studentId, period },
  });
  return toPoolEntry(entry);
}

async function getPoolList(filters = {}) {
  const {
    period = '2024-1',
    program_studi = null,
    sdg_topic = null,
    status = 'waiting',
    page = 1,
    limit = 10,
    skill = null,
  } = filters;

  const where = {
    period,
    deletedAt: null,
    ...(status && { status }),
    ...(program_studi && { programStudi: program_studi }),
    ...(sdg_topic && { sdgTopics: { has: parseInt(sdg_topic, 10) } }),
    ...(skill && { talentSkills: { some: { skillName: skill.toLowerCase() } } }),
  };

  const offset = (page - 1) * limit;

  const [items, total] = await prisma.$transaction([
    prisma.poolEntry.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        studentId: true,
        studentName: true,
        programStudi: true,
        sdgTopics: true,
        availability: true,
        notes: true,
        status: true,
        period: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.poolEntry.count({ where }),
  ]);

  return {
    data: items.map(toPoolEntry),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ── Writes (accept optional tx for transactions) ───────────────────────────

async function createEntry(data, tx = prisma) {
  const entry = await tx.poolEntry.create({
    data: {
      studentId: data.studentId,
      studentName: data.studentName,
      programStudi: data.programStudi,
      sdgTopics: data.sdgTopics || [],
      availability: data.availability || 'full-time',
      notes: data.notes || null,
      period: data.period,
    },
  });
  return toPoolEntry(entry);
}

async function rejoinEntry(id, tx = prisma) {
  const entry = await tx.poolEntry.update({
    where: { id },
    data: { status: 'waiting', deletedAt: null },
  });
  return toPoolEntry(entry);
}

async function updateStatus(studentId, period, status, tx = prisma) {
  return tx.poolEntry.updateMany({
    where: { studentId, period, deletedAt: null },
    data: { status },
  });
}

async function withdraw(id, tx = prisma) {
  const entry = await tx.poolEntry.update({
    where: { id },
    data: { status: 'withdrawn', deletedAt: new Date() },
    select: {
      id: true,
      studentId: true,
      studentName: true,
      programStudi: true,
      status: true,
      period: true,
      updatedAt: true,
    },
  });
  return toPoolEntry(entry);
}

async function replaceTalentSkills(studentId, period, skills, tx = prisma) {
  await tx.talentSkill.deleteMany({ where: { studentId, period } });
  if (skills && skills.length > 0) {
    await tx.talentSkill.createMany({
      data: skills.map((s) => ({
        studentId,
        skillName: String(s.name).toLowerCase(),
        skillLevel: s.level || 1,
        period,
      })),
    });
  }
}

module.exports = {
  findEntry,
  getPoolList,
  createEntry,
  rejoinEntry,
  updateStatus,
  withdraw,
  replaceTalentSkills,
};
