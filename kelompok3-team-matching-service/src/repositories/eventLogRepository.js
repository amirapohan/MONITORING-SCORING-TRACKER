// Ported from raw `pg` to Prisma (EventLog model).
// API unchanged so eventPublisher.js works without modification.
const prisma = require('../core/prisma');

async function createEventLog(eventType, payload) {
  return prisma.eventLog.create({
    data: { eventType, payload, status: 'pending' },
  });
}

async function updateEventLogStatus(id, status) {
  return prisma.eventLog.update({
    where: { id },
    data: { status },
  });
}

module.exports = { createEventLog, updateEventLogStatus };
