const poolRepo = require('../repositories/poolRepository');
const { publishToEventLog } = require('./eventPublisher');

function formatSkills(skillsData) {
  if (!skillsData) return [];
  if (Array.isArray(skillsData)) return skillsData;
  return Object.entries(skillsData).map(([name, level]) => ({ name, level }));
}

async function joinPool(studentId, studentName, programStudi, data) {
  const { sdg_topics = [], availability = 'full-time', notes = null, period, skills } = data;
  const formattedSkills = formatSkills(skills);

  const existing = await poolRepo.findEntry(studentId, period);

  let poolEntry;

  if (existing) {
    if (existing.status === 'withdrawn' || existing.deleted_at !== null) {
      poolEntry = await poolRepo.rejoinEntry(existing.id);
      await poolRepo.replaceTalentSkills(studentId, period, formattedSkills);
    } else {
      throw { status: 409, message: 'duplicate_entry', detail: `Student sudah aktif di pool dengan status: ${existing.status}` };
    }
  } else {
    poolEntry = await poolRepo.createEntry({ studentId, studentName, programStudi, sdgTopics: sdg_topics, availability, notes, period });
    await poolRepo.replaceTalentSkills(studentId, period, formattedSkills);
  }

  publishToEventLog('POOL_JOINED', {
    pool_entry_id: poolEntry.id,
    student_id: studentId,
    student_name: studentName,
    period: poolEntry.period,
  }).catch((err) => console.error('[event-publisher] Failed to publish POOL_JOINED:', err.message));

  poolEntry.skills = formattedSkills;
  return poolEntry;
}

async function getPoolList(filters = {}) {
  return poolRepo.getPoolList(filters);
}

async function withdrawFromPool(studentId, period) {
  const existing = await poolRepo.findEntry(studentId, period);

  if (!existing || existing.deleted_at !== null) {
    const err = new Error('not_found');
    err.detail = 'Mahasiswa tidak ditemukan di pool';
    err.status = 404;
    throw err;
  }

  if (existing.status !== 'waiting') {
    const err = new Error('invalid_status');
    err.detail = `Tidak bisa keluar pool jika status ${existing.status}`;
    err.status = 400;
    throw err;
  }

  const withdrawn = await poolRepo.withdraw(existing.id);

  publishToEventLog('POOL_WITHDRAWN', {
    pool_entry_id: withdrawn.id,
    student_id: withdrawn.student_id,
    period: withdrawn.period,
  }).catch((err) => console.error('[event-publisher] Failed to publish POOL_WITHDRAWN:', err.message));

  return withdrawn;
}

module.exports = { joinPool, getPoolList, withdrawFromPool };
