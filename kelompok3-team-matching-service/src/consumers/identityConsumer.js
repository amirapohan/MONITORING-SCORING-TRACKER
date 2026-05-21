const { subscribe } = require('../utils/rabbitmq');
const prisma = require('../core/prisma');

const IDENTITY_EXCHANGE = 'identity.events';
const QUEUE_NAME = 'match.from.identity';
const ROUTING_KEYS = ['user.registered', 'user.deactivated'];

async function handleIdentityEvent(event) {
  const { eventType, userId, payload } = event;

  switch (eventType) {
    case 'REGISTER':
      // No action needed — pool/team records are created on demand when the user
      // explicitly joins the pool or a team.
      console.log(`[IdentityConsumer] New user registered: ${userId}`);
      break;

    case 'USER_DEACTIVATED': {
      const targetId = payload?.targetUserId ?? userId;

      // Soft-delete all active pool entries
      await prisma.poolEntry.updateMany({
        where: { studentId: targetId, deletedAt: null },
        data: { deletedAt: new Date(), status: 'inactive' },
      });

      // Soft-remove from all active team memberships
      await prisma.teamMember.updateMany({
        where: { studentId: targetId, leftAt: null },
        data: { leftAt: new Date(), leftReason: 'account_deactivated' },
      });

      console.log(`[IdentityConsumer] Deactivated user ${targetId} removed from pool and teams`);
      break;
    }

    default:
      break;
  }
}

async function startIdentityConsumer() {
  await subscribe(
    IDENTITY_EXCHANGE,
    'topic',
    QUEUE_NAME,
    ROUTING_KEYS,
    handleIdentityEvent,
  );
}

module.exports = { startIdentityConsumer };
