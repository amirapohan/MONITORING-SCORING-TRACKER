const prisma = require('../core/prisma');
const teamRepo = require('../repositories/teamRepository');
const poolRepo = require('../repositories/poolRepository');
const { recalculateTeamScores } = require('./advancedScoringService');
const { publishToEventLog } = require('./eventPublisher');

// ── Reads (delegated to repository) ───────────────────────────────────────

async function getTeamById(teamId) {
  return teamRepo.findTeamById(teamId);
}

async function getTeamByPoStudentId(poStudentId) {
  return teamRepo.findTeamByPoStudentId(poStudentId);
}

async function getPoolEntryByStudentAndPeriod(studentId, period) {
  return poolRepo.findEntry(studentId, period);
}

async function getTeamList() {
  return teamRepo.getTeamList();
}

async function getTeamListBySkill(skillName) {
  return teamRepo.getTeamListBySkill(skillName);
}

async function getTeamDetail(teamId) {
  return teamRepo.getTeamDetail(teamId);
}

async function getActiveTeamForMember(studentId) {
  return teamRepo.findActiveTeamForMember(studentId);
}

// ── Writes ─────────────────────────────────────────────────────────────────

async function createTeam({ name, period, createdBy, poStudentId, poStudentName, poProgramStudi }) {
  const existing = await teamRepo.findTeamByPoStudentId(poStudentId);
  if (existing && existing.period === period) {
    const err = new Error('duplicate_team');
    err.detail = 'Mahasiswa sudah punya tim aktif/forming di period ini';
    err.status = 409;
    throw err;
  }

  const team = await prisma.$transaction(async (tx) => {
    const newTeam = await teamRepo.createTeam({ name, period, createdBy, poStudentId }, tx);
    await teamRepo.createMember(
      { teamId: newTeam.id, studentId: poStudentId, studentName: poStudentName, programStudi: poProgramStudi, roleInTeam: 'po' },
      tx
    );
    await poolRepo.updateStatus(poStudentId, period, 'in_team', tx);
    return newTeam;
  });

  publishToEventLog('TEAM_CREATED', {
    team_id: team.id,
    name: team.name,
    period: team.period,
    po_student_id: team.po_student_id,
    created_at: team.created_at,
  }).catch((err) => console.error('[event-publisher] Failed to publish TEAM_CREATED:', err.message));

  return team;
}

async function inviteMemberToTeam({ teamId, inviterStudentId, inviteeStudentId, message = null }) {
  const team = await teamRepo.findTeamById(teamId);
  if (!team) throw { status: 404, message: 'team_not_found', detail: 'Tim tidak ditemukan' };
  if (team.status !== 'forming') throw { status: 400, message: 'invalid_team_status', detail: 'Hanya tim berstatus forming yang bisa mengundang anggota' };
  if (team.po_student_id !== inviterStudentId) throw { status: 403, message: 'forbidden', detail: 'Hanya PO tim yang boleh mengirim undangan' };

  const inviterMember = await teamRepo.findMember(teamId, inviterStudentId);
  if (!inviterMember || inviterMember.role_in_team !== 'po') throw { status: 403, message: 'forbidden', detail: 'Hanya PO tim yang boleh mengirim undangan' };

  const inviteePoolEntry = await poolRepo.findEntry(inviteeStudentId, team.period);
  if (!inviteePoolEntry) throw { status: 404, message: 'invitee_not_found', detail: 'Mahasiswa yang diundang tidak ditemukan di pool pada period ini' };
  if (inviteePoolEntry.status === 'withdrawn') throw { status: 400, message: 'withdrawn_user', detail: 'Mahasiswa sudah keluar dari pool dan tidak bisa diundang' };
  if (inviteePoolEntry.status !== 'waiting') throw { status: 400, message: 'invalid_pool_status', detail: `Status mahasiswa saat ini adalah ${inviteePoolEntry.status}, harus waiting` };

  const existingInvite = await teamRepo.findPendingInvite(teamId, inviteeStudentId);
  if (existingInvite) throw { status: 409, message: 'duplicate_invite', detail: 'Undangan pending sudah ada untuk mahasiswa ini' };

  return teamRepo.createInvite({ teamId, inviterStudentId, inviteeStudentId, message });
}

async function respondToInvite({ inviteId, respondentStudentId, response }) {
  const invite = await teamRepo.findInvite(inviteId);
  if (!invite) throw { status: 404, message: 'invite_not_found', detail: 'Undangan tidak ditemukan' };
  if (invite.invitee_student_id !== respondentStudentId) throw { status: 403, message: 'forbidden', detail: 'Hanya penerima undangan yang boleh merespon' };
  if (invite.status !== 'pending') throw { status: 400, message: 'invalid_invite_status', detail: `Undangan sudah ${invite.status}` };

  const team = await teamRepo.findTeamById(invite.team_id);
  if (!team) throw { status: 404, message: 'team_not_found', detail: 'Tim pada undangan tidak ditemukan' };

  const inviteePoolEntry = await poolRepo.findEntry(invite.invitee_student_id, team.period);
  if (!inviteePoolEntry) throw { status: 404, message: 'invitee_not_found', detail: 'Mahasiswa penerima undangan tidak ditemukan di pool' };

  if (response === 'accepted') {
    const existingMember = await teamRepo.findMember(invite.team_id, invite.invitee_student_id);
    if (existingMember) throw { status: 409, message: 'already_member', detail: 'Mahasiswa sudah menjadi anggota tim' };
    if (inviteePoolEntry.status !== 'waiting') throw { status: 400, message: 'invitee_not_available', detail: `Mahasiswa penerima undangan harus berstatus waiting (Status saat ini: ${inviteePoolEntry.status})` };

    const updatedInvite = await prisma.$transaction(async (tx) => {
      await teamRepo.createMember(
        { teamId: invite.team_id, studentId: invite.invitee_student_id, studentName: inviteePoolEntry.student_name, programStudi: inviteePoolEntry.program_studi },
        tx
      );
      await poolRepo.updateStatus(invite.invitee_student_id, team.period, 'in_team', tx);
      return teamRepo.updateInviteStatus(inviteId, 'accepted', tx);
    });

    publishToEventLog('TEAM_MEMBER_JOINED', {
      team_id: invite.team_id,
      student_id: invite.invitee_student_id,
      period: team.period,
      joined_via: 'invite',
    }).catch((err) => console.error('[event-publisher] Failed to publish TEAM_MEMBER_JOINED:', err.message));

    recalculateTeamScores(invite.team_id, team.period).catch((err) => console.error('[SCORING ERROR]', err));

    return updatedInvite;
  }

  if (response === 'rejected') {
    return teamRepo.updateInviteStatus(inviteId, 'rejected');
  }

  throw { status: 400, message: 'invalid_response', detail: 'Response harus accepted atau rejected' };
}

async function updateRequiredSkills(teamId, poStudentId, requiredSkills) {
  const team = await teamRepo.findTeamById(teamId);
  if (!team) throw { status: 404, message: 'team_not_found', detail: 'Tim tidak ditemukan' };
  if (team.po_student_id !== poStudentId) throw { status: 403, message: 'forbidden', detail: 'Hanya PO yang bisa update required skills' };

  await prisma.$transaction((tx) => teamRepo.replaceRequiredSkills(teamId, requiredSkills, tx));
  return { id: teamId, required_skills: requiredSkills };
}

async function createJoinRequest({ teamId, studentId, message }) {
  const team = await teamRepo.findTeamById(teamId);
  if (!team || team.status !== 'forming') throw { status: 400, message: 'invalid_team', detail: 'Tim tidak ditemukan atau tidak berstatus forming' };

  const poolCheck = await poolRepo.findEntry(studentId, team.period);
  if (!poolCheck) throw { status: 404, message: 'pool_entry_not_found', detail: 'Kamu belum join pool' };
  if (poolCheck.status === 'withdrawn') throw { status: 400, message: 'withdrawn_user', detail: 'Kamu sudah keluar dari pool dan tidak bisa mengirim request' };
  if (poolCheck.status !== 'waiting') throw { status: 400, message: 'invalid_pool_status', detail: `Hanya status waiting yang bisa apply. Status kamu saat ini: ${poolCheck.status}` };

  return teamRepo.createJoinRequest({ teamId, studentId, message });
}

async function respondJoinRequest({ requestId, poStudentId, response }) {
  const joinReq = await teamRepo.findJoinRequest(requestId);
  if (!joinReq) throw { status: 404, message: 'request_not_found', detail: 'Request join tidak ditemukan' };

  const team = await teamRepo.findTeamById(joinReq.team_id);
  if (team.po_student_id !== poStudentId) throw { status: 403, message: 'forbidden', detail: 'Hanya PO yang berhak merespons' };

  if (response === 'accepted') {
    const poolCheck = await poolRepo.findEntry(joinReq.requester_student_id, team.period);
    if (!poolCheck || poolCheck.status !== 'waiting') throw { status: 400, message: 'invalid_pool_status', detail: 'Kandidat sudah tidak available (status bukan waiting)' };

    const result = await prisma.$transaction(async (tx) => {
      await teamRepo.createMember(
        { teamId: team.id, studentId: joinReq.requester_student_id, studentName: poolCheck.student_name, programStudi: poolCheck.program_studi },
        tx
      );
      await poolRepo.updateStatus(joinReq.requester_student_id, team.period, 'in_team', tx);
      return teamRepo.updateJoinRequestStatus(requestId, 'accepted', tx);
    });

    publishToEventLog('TEAM_MEMBER_JOINED', {
      team_id: team.id,
      student_id: joinReq.requester_student_id,
      period: team.period,
      joined_via: 'join_request',
    }).catch((err) => console.error('[event-publisher] Failed to publish TEAM_MEMBER_JOINED:', err.message));

    recalculateTeamScores(team.id, team.period).catch((err) => console.error('[SCORING ERROR]', err));

    return result;
  }

  return teamRepo.updateJoinRequestStatus(requestId, 'rejected');
}

async function removeMember(teamId, targetStudentId, period) {
  const memberCheck = await prisma.teamMember.findFirst({
    where: { teamId, studentId: targetStudentId },
    orderBy: { joinedAt: 'desc' },
  });

  if (!memberCheck) throw { status: 404, message: 'not_in_team', detail: 'User tidak ditemukan di riwayat tim ini' };
  if (memberCheck.leftAt !== null) throw { status: 400, message: 'already_left', detail: 'User tersebut sudah bukan anggota aktif di tim ini' };

  await prisma.$transaction(async (tx) => {
    await teamRepo.setMemberLeft(teamId, targetStudentId, tx);
    await poolRepo.updateStatus(targetStudentId, period, 'waiting', tx);
  });

  publishToEventLog('TEAM_MEMBER_REMOVED', {
    team_id: teamId,
    student_id: targetStudentId,
    period,
  }).catch((err) => console.error('[event-publisher] Failed to publish TEAM_MEMBER_REMOVED:', err.message));

  recalculateTeamScores(teamId, period).catch((err) => console.error('[SCORING ERROR]', err));

  return { success: true };
}

module.exports = {
  getTeamById,
  getTeamByPoStudentId,
  getPoolEntryByStudentAndPeriod,
  getTeamList,
  getTeamListBySkill,
  getTeamDetail,
  getActiveTeamForMember,
  createTeam,
  inviteMemberToTeam,
  respondToInvite,
  updateRequiredSkills,
  createJoinRequest,
  respondJoinRequest,
  removeMember,
};
