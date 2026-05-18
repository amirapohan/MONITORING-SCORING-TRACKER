// Ported from raw `pg` pool to Prisma (EventLog model).
// API unchanged so event_publisher.js works without modification.
const prisma = require("../core/prisma");

async function createEventLog(payload) {
  return prisma.eventLog.create({
    data: {
      eventType: payload.eventType,
      payload: payload.payload,
      status: payload.status || "pending",
    },
  });
}

async function updateEventLogStatus(id, status) {
  return prisma.eventLog.update({
    where: { id },
    data: { status },
  });
}

module.exports = {
  createEventLog,
  updateEventLogStatus,
};
