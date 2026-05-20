const prisma = require('../core/prisma');
const teamRepo = require('../repositories/teamRepository');

function calculateJaccard(setA, setB) {
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function calculateSDGAlignment(membersSDGs) {
  if (membersSDGs.length < 2) return 1.0;
  let totalScore = 0, pairs = 0;
  for (let i = 0; i < membersSDGs.length; i++) {
    for (let j = i + 1; j < membersSDGs.length; j++) {
      totalScore += calculateJaccard(new Set(membersSDGs[i]), new Set(membersSDGs[j]));
      pairs++;
    }
  }
  return totalScore / pairs;
}

function calculateCV(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  return Math.sqrt(variance) / mean;
}

function calculateSkillBalanceScore(membersSkillsList) {
  if (membersSkillsList.length < 2) return 1.0;
  const skillSet = new Set();
  membersSkillsList.forEach(skills => Object.keys(skills).forEach(k => skillSet.add(k)));
  const dimensions = Array.from(skillSet);
  if (dimensions.length === 0) return 0;
  const cvSum = dimensions.reduce((sum, dim) => {
    return sum + calculateCV(membersSkillsList.map(s => s[dim] || 0));
  }, 0);
  return Math.max(0, Math.min(1, 1 - cvSum / dimensions.length));
}

// Complex JOIN with json_object_agg — kept as raw SQL
async function recalculateTeamScores(teamId, period) {
  const members = await prisma.$queryRawUnsafe(
    `SELECT p.sdg_topics,
            COALESCE(
              json_object_agg(ts.skill_name, ts.skill_level) FILTER (WHERE ts.skill_name IS NOT NULL),
              '{}'::json
            ) as skills
     FROM team_members tm
     JOIN pool_entries p ON tm.student_id = p.student_id AND p.period = $2
     LEFT JOIN talent_skills ts ON p.student_id = ts.student_id AND ts.period = $2
     WHERE tm.team_id = $1 AND tm.left_at IS NULL
     GROUP BY tm.id, p.sdg_topics`,
    teamId,
    period
  );

  if (members.length === 0) return;

  const skillBalance = calculateSkillBalanceScore(members.map(m => m.skills || {}));
  const sdgAlignment = calculateSDGAlignment(members.map(m => m.sdg_topics || []));

  await teamRepo.updateScore(teamId, skillBalance, sdgAlignment);
}

module.exports = { recalculateTeamScores };
