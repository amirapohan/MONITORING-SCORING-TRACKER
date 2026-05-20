const profileRepo = require('../repositories/profileRepository');
const { publishToEventLog } = require('./eventPublisher');

async function getProfileSkills(studentId, period = '2024-1') {
  return profileRepo.getProfileSkills(studentId, period);
}

async function updateProfileSkills(studentId, period, skills, sdgTopics) {
  const result = await profileRepo.updateProfileSkills(studentId, period, skills, sdgTopics);

  publishToEventLog('PROFILE_SKILLS_UPDATED', {
    student_id: studentId,
    period,
    skills,
    sdg_topics: sdgTopics,
  }).catch((err) => console.error('[event-publisher] Failed to publish PROFILE_SKILLS_UPDATED:', err.message));

  return result;
}

module.exports = { getProfileSkills, updateProfileSkills };
