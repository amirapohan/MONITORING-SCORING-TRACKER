const prisma = require('../core/prisma');

function calculateSkillMatch(reqSkills, talentSkills) {
  if (!reqSkills || !Array.isArray(reqSkills) || reqSkills.length === 0) return 1;
  let matchCount = 0;
  reqSkills.forEach(req => {
    const reqName = (req.name || '').toLowerCase();
    let hasSkill = false;
    if (Array.isArray(talentSkills)) {
      hasSkill = !!talentSkills.find(s => s.name && s.name.toLowerCase() === reqName);
      if (!hasSkill) {
        if ((reqName.includes('ui') || reqName.includes('ux')) && talentSkills.find(s => s.name && s.name.toLowerCase() === 'design')) hasSkill = true;
        if ((reqName.includes('back') || reqName.includes('front') || reqName.includes('web')) && talentSkills.find(s => s.name && s.name.toLowerCase() === 'programming')) hasSkill = true;
      }
    } else if (talentSkills && typeof talentSkills === 'object') {
      if (talentSkills[reqName] && talentSkills[reqName] > 0) hasSkill = true;
      else {
        if ((reqName.includes('ui') || reqName.includes('ux')) && talentSkills['design'] > 0) hasSkill = true;
        if ((reqName.includes('back') || reqName.includes('front') || reqName.includes('web')) && talentSkills['programming'] > 0) hasSkill = true;
      }
    }
    if (hasSkill) matchCount++;
  });
  return matchCount / reqSkills.length;
}

// Complex JOINs with json_agg — kept as raw SQL
async function recommendMembersForTeam(teamId) {
  const [teamRows] = await prisma.$queryRawUnsafe(
    `SELECT t.id, t.period,
       COALESCE(json_agg(json_build_object('name', trs.skill_name, 'count', trs.required_count)) FILTER (WHERE trs.skill_name IS NOT NULL), '[]') as required_skills
     FROM teams t
     LEFT JOIN team_required_skills trs ON t.id = trs.team_id
     WHERE t.id = $1
     GROUP BY t.id, t.period`,
    teamId
  );
  if (!teamRows) throw { status: 404, message: 'team_not_found' };

  const candidates = await prisma.$queryRawUnsafe(
    `SELECT p.id, p.student_id, p.student_name, p.program_studi, p.sdg_topics,
       COALESCE(json_agg(json_build_object('name', ts.skill_name, 'level', ts.skill_level)) FILTER (WHERE ts.skill_name IS NOT NULL), '[]') as skills
     FROM pool_entries p
     LEFT JOIN talent_skills ts ON p.student_id = ts.student_id AND p.period = ts.period
     WHERE p.status = 'waiting' AND p.period = $1 AND p.deleted_at IS NULL
     GROUP BY p.id`,
    teamRows.period
  );

  return candidates
    .map(talent => ({ ...talent, matchScore: calculateSkillMatch(teamRows.required_skills, talent.skills) }))
    .sort((a, b) => b.matchScore - a.matchScore);
}

async function recommendTeamsForMember(studentId, period) {
  const [talent] = await prisma.$queryRawUnsafe(
    `SELECT p.id, p.student_id, p.sdg_topics,
       COALESCE(json_agg(json_build_object('name', ts.skill_name, 'level', ts.skill_level)) FILTER (WHERE ts.skill_name IS NOT NULL), '[]') as skills
     FROM pool_entries p
     LEFT JOIN talent_skills ts ON p.student_id = ts.student_id AND p.period = ts.period
     WHERE p.student_id = $1 AND p.period = $2 AND p.deleted_at IS NULL
     GROUP BY p.id`,
    studentId,
    period
  );
  if (!talent) throw { status: 404, message: 'pool_entry_not_found' };

  const teams = await prisma.$queryRawUnsafe(
    `SELECT t.id, t.name, t.po_student_id,
       COALESCE(json_agg(json_build_object('name', trs.skill_name, 'count', trs.required_count)) FILTER (WHERE trs.skill_name IS NOT NULL), '[]') as required_skills
     FROM teams t
     LEFT JOIN team_required_skills trs ON t.id = trs.team_id
     WHERE t.status = 'forming' AND t.period = $1
     GROUP BY t.id`,
    period
  );

  return teams
    .map(team => ({ ...team, matchScore: calculateSkillMatch(team.required_skills, talent.skills) }))
    .sort((a, b) => b.matchScore - a.matchScore);
}

module.exports = {
  getMemberRecommendations: recommendMembersForTeam,
  getTeamRecommendations: recommendTeamsForMember,
};
