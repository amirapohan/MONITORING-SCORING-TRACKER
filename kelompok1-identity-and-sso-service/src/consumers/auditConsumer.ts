import { getConsumeChannel } from "../messaging/connection";
import { AUDIT_QUEUE, type EventMessage } from "../messaging/eventTypes";
import { auditLogRepository } from "../repositories/auditLog.repository";

export const startAuditConsumer = async (): Promise<void> => {
  const ch = getConsumeChannel();
  await ch.prefetch(10);

  await ch.consume(AUDIT_QUEUE, async (msg) => {
    if (!msg) return;

    let event: EventMessage;
    try {
      event = JSON.parse(msg.content.toString()) as EventMessage;
    } catch {
      console.error("[AuditConsumer] malformed message — nacking without requeue");
      ch.nack(msg, false, false);
      return;
    }

    try {
      await auditLogRepository.create({
        action: event.eventType,
        userId: event.userId ?? undefined,
        ip: event.ip ?? undefined,
        userAgent: event.userAgent ?? undefined,
        metadata: event.payload as import("@prisma/client").Prisma.InputJsonValue,
        outboxEventId: event.id,
      });
      ch.ack(msg);
    } catch (err: unknown) {
      const isUniqueViolation =
        err instanceof Error && err.message.includes("outbox_event_id");
      if (isUniqueViolation) {
        // already processed — ack so message is not redelivered
        ch.ack(msg);
      } else {
        console.error("[AuditConsumer] failed to write audit log, requeueing:", (err as Error).message);
        ch.nack(msg, false, true);
      }
    }
  });

  console.log(`[AuditConsumer] listening on queue: ${AUDIT_QUEUE}`);
};
