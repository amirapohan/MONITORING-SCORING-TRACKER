const prisma = require('../core/prisma');

// ── Transform helpers (Prisma camelCase → API snake_case) ──────────────────

function toTeam(t) {
  if (!t) return null;
  return {
    id: t.id,
    name: t.name,
    status: t.status,
    period: t.period,
    created_by: t.createdBy,
    po_student_id: t.poStudentId,
    created_at: t.createdAt,
    disbanded_at: t.disbandedAt,
    skill_balance_score: t.skillBalanceScore,
    sdg_alignment_score: t.sdgAlignmentScore,
  };
}

function toMember(m) {
  if (!m) return null;
  return {
    id: m.id,
    team_id: m.teamId,
    student_id: m.studentId,
    student_name: m.studentName,
    program_studi: m.programStudi,
    role_in_team: m.roleInTeam,
    joined_at: m.joinedAt,
    left_at: m.leftAt,
  };
}

function toInvite(i) {
  if (!i) return null;
  return {
    id: i.id,
    team_id: i.teamId,
    inviter_student_id: i.inviterStudentId,
    invitee_student_id: i.inviteeStudentId,
    status: i.status,
    message: i.message,
    created_at: i.createdAt,
    responded_at: i.respondedAt,
  };
}

function toJoinRequest(r) {
  if (!r) return null;
  return {
    id: r.id,
    team_id: r.teamId,
    requester_student_id: r.requesterStudentId,
    status: r.status,
    message: r.message,
    reject_reason: r.rejectReason,
    created_at: r.createdAt,
    responded_at: r.respondedAt,
  };
}

// ── Reads ──────────────────────────────────────────────────────────────────

async function findTeamById(id) {
  const team = await prisma.team.findUnique({ where: { id } });
  return toTeam(team);
}

async function findTeamByPoStudentId(poStudentId) {
  const team = await prisma.team.findFirst({
    where: { poStudentId, status: { in: ['forming', 'active'] } },
  });
  return toTeam(team);
}

async function findMember(teamId, studentId) {
  const m = await prisma.teamMember.findFirst({
    where: { teamId, studentId, leftAt: null },
  });
  return toMember(m);
}

async function findActiveTeamForMember(studentId) {
  const m = await prisma.teamMember.findFirst({
    where: { studentId, leftAt: null, team: { status: { in: ['forming', 'active'] } } },
    select: { teamId: true, team: { select: { period: true, poStudentId: true } } },
  });
  if (!m) return null;
  return { team_id: m.teamId, period: m.team.period, po_student_id: m.team.poStudentId };
}

async function findInvite(inviteId) {
  const i = await prisma.teamInvite.findUnique({ where: { id: inviteId } });
  return toInvite(i);
}

async function findPendingInvite(teamId, inviteeStudentId) {
  const i = await prisma.teamInvite.findFirst({
    where: { teamId, inviteeStudentId, status: 'pending' },
  });
  return toInvite(i);
}

async function findJoinRequest(requestId) {
  const r = await prisma.teamJoinRequest.findFirst({
    where: { id: requestId, status: 'pending' },
  });
  return toJoinRequest(r);
}

async function getTeamList() {
  const teams = await prisma.team.findMany({
    where: { status: 'forming' },
    select: {
      id: true,
      name: true,
      status: true,
      poStudentId: true,
      requiredSkills: { select: { skillName: true, requiredCount: true } },
    },
  });
  return teams.map((t) => ({
    id: t.id,
    name: t.name,
    status: t.status,
    po_student_id: t.poStudentId,
    required_skills: t.requiredSkills.map((s) => ({ name: s.skillName, count: s.requiredCount })),
  }));
}

async function getTeamListBySkill(skillName) {
  const teams = await prisma.team.findMany({
    where: {
      status: 'forming',
      requiredSkills: { some: { skillName: skillName.toLowerCase() } },
    },
    select: {
      id: true,
      name: true,
      status: true,
      poStudentId: true,
      requiredSkills: { select: { skillName: true, requiredCount: true } },
    },
  });
  return teams.map((t) => ({
    id: t.id,
    name: t.name,
    status: t.status,
    po_student_id: t.poStudentId,
    required_skills: t.requiredSkills.map((s) => ({ name: s.skillName, count: s.requiredCount })),
  }));
}

async function getTeamDetail(teamId) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        where: { leftAt: null },
        select: { studentId: true, studentName: true, roleInTeam: true },
      },
      requiredSkills: { select: { skillName: true, requiredCount: true } },
    },
  });
  if (!team) return null;
  return {
    ...toTeam(team),
    members: team.members.map((m) => ({
      student_id: m.studentId,
      student_name: m.studentName,
      role_in_team: m.roleInTeam,
    })),
    required_skills: team.requiredSkills.map((s) => ({ name: s.skillName, count: s.requiredCount })),
  };
}

// ── Writes (accept optional tx for transactions) ───────────────────────────

async function createTeam(data, tx = prisma) {
  const team = await tx.team.create({
    data: {
      name: data.name,
      period: data.period,
      createdBy: data.createdBy,
      poStudentId: data.poStudentId,
    },
  });
  return toTeam(team);
}

async function createMember(data, tx = prisma) {
  return tx.teamMember.create({
    data: {
      teamId: data.teamId,
      studentId: data.studentId,
      studentName: data.studentName,
      programStudi: data.programStudi,
      roleInTeam: data.roleInTeam || 'member',
    },
  });
}

async function createInvite(data) {
  const i = await prisma.teamInvite.create({
    data: {
      teamId: data.teamId,
      inviterStudentId: data.inviterStudentId,
      inviteeStudentId: data.inviteeStudentId,
      message: data.message || null,
    },
  });
  return toInvite(i);
}

async function updateInviteStatus(inviteId, status, tx = prisma) {
  const i = await tx.teamInvite.update({
    where: { id: inviteId },
    data: { status, respondedAt: new Date() },
  });
  return toInvite(i);
}

async function createJoinRequest(data) {
  const r = await prisma.teamJoinRequest.create({
    data: {
      teamId: data.teamId,
      requesterStudentId: data.studentId,
      message: data.message || null,
    },
  });
  return toJoinRequest(r);
}

async function updateJoinRequestStatus(requestId, status, tx = prisma) {
  const r = await tx.teamJoinRequest.update({
    where: { id: requestId },
    data: { status, respondedAt: new Date() },
  });
  return toJoinRequest(r);
}

async function setMemberLeft(teamId, studentId, tx = prisma) {
  return tx.teamMember.updateMany({
    where: { teamId, studentId, leftAt: null },
    data: { leftAt: new Date() },
  });
}

async function replaceRequiredSkills(teamId, skills, tx = prisma) {
  await tx.teamRequiredSkill.deleteMany({ where: { teamId } });
  if (skills && skills.length > 0) {
    await tx.teamRequiredSkill.createMany({
      data: skills.map((s) => ({
        teamId,
        skillName: String(s.name).toLowerCase(),
        requiredCount: s.count || 1,
      })),
    });
  }
}

async function updateScore(teamId, skillBalanceScore, sdgAlignmentScore) {
  return prisma.team.update({
    where: { id: teamId },
    data: { skillBalanceScore, sdgAlignmentScore },
  });
}

module.exports = {
  findTeamById,
  findTeamByPoStudentId,
  findMember,
  findActiveTeamForMember,
  findInvite,
  findPendingInvite,
  findJoinRequest,
  getTeamList,
  getTeamListBySkill,
  getTeamDetail,
  createTeam,
  createMember,
  createInvite,
  updateInviteStatus,
  createJoinRequest,
  updateJoinRequestStatus,
  setMemberLeft,
  replaceRequiredSkills,
  updateScore,
};
