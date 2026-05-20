import { type EventMessage } from "../messaging/eventTypes";
import { publishEvent } from "../messaging/publisher";
import { outboxEventRepository } from "../repositories/outboxEvent.repository";

const POLL_INTERVAL_MS = 2000;
const BATCH_SIZE = 100;

let timer: ReturnType<typeof setInterval> | null = null;

const relay = async (): Promise<void> => {
  const rows = await outboxEventRepository.findUnpublished(BATCH_SIZE);
  for (const row of rows) {
    const message: EventMessage = {
      id: row.id,
      eventType: row.eventType,
      userId: row.userId,
      ip: row.ip,
      userAgent: row.userAgent,
      payload: row.payload,
      createdAt: row.createdAt.toISOString(),
    };
    await publishEvent(message);
    await outboxEventRepository.markPublished(row.id);
  }
};

export const startOutboxRelay = (): void => {
  timer = setInterval(async () => {
    try {
      await relay();
    } catch (err) {
      console.error("[OutboxRelay] error:", (err as Error).message);
    }
  }, POLL_INTERVAL_MS);

  console.log(`[OutboxRelay] started — polling every ${POLL_INTERVAL_MS}ms`);
};

export const stopOutboxRelay = (): void => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  console.log("[OutboxRelay] stopped");
};
