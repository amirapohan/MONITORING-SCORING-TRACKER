import { getConsumeChannel, getPublishChannel } from "./connection";
import { AUDIT_QUEUE, EXCHANGE } from "./eventTypes";

export const assertTopology = async (): Promise<void> => {
  const ch = getPublishChannel();
  await ch.assertExchange(EXCHANGE, "topic", { durable: true });

  const consumeCh = getConsumeChannel();
  await consumeCh.assertExchange(EXCHANGE, "topic", { durable: true });
  await consumeCh.assertQueue(AUDIT_QUEUE, { durable: true });
  await consumeCh.bindQueue(AUDIT_QUEUE, EXCHANGE, "#");

  console.log(`[RabbitMQ] topology ready — exchange: ${EXCHANGE}, queue: ${AUDIT_QUEUE}`);
};
