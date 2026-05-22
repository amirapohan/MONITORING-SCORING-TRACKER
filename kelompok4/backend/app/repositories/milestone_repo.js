// Ported from raw `pg` pool to Prisma (Milestone model).
// Return shape and method signatures kept identical so milestone_service.js
// works without modification.
const prisma = require("../core/prisma");

function mapMilestone(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    paymentAmount: Number(row.paymentAmount),
    description: row.description,
    deadline: row.deadline,
    employerId: row.employerId,
    studentId: row.studentId,
    projectId: row.projectId,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function createMilestone(payload) {
  const row = await prisma.milestone.create({
    data: {
      title: payload.title,
      paymentAmount: payload.paymentAmount,
      description: payload.description,
      deadline: payload.deadline,
      employerId: payload.employerId,
      studentId: payload.studentId,
      projectId: payload.projectId ?? null,
      status: payload.status || "open",
    },
  });

  return mapMilestone(row);
}

async function listMilestones(filters = {}) {
  const where = {};

  if (filters.employerId) {
    where.employerId = filters.employerId;
  }

  if (filters.studentId) {
    where.studentId = filters.studentId;
  }

  if (filters.projectId) {
    where.projectId = filters.projectId;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  const rows = await prisma.milestone.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return rows.map(mapMilestone);
}

async function getMilestoneById(id) {
  const row = await prisma.milestone.findUnique({
    where: { id },
  });

  return mapMilestone(row);
}

async function updateMilestone(id, payload) {
  const data = {};

  if (payload.title !== undefined) {
    data.title = payload.title;
  }

  if (payload.paymentAmount !== undefined) {
    data.paymentAmount = payload.paymentAmount;
  }

  if (payload.description !== undefined) {
    data.description = payload.description;
  }

  if (payload.deadline !== undefined) {
    data.deadline = payload.deadline;
  }

  if (payload.status !== undefined) {
    data.status = payload.status;
  }

  // Mirror the raw-SQL guard: only update when not already completed.
  const result = await prisma.milestone.updateMany({
    where: { id, status: { not: "completed" } },
    data,
  });

  if (result.count === 0) {
    return null;
  }

  return getMilestoneById(id);
}

module.exports = {
  createMilestone,
  listMilestones,
  getMilestoneById,
  updateMilestone,
};
