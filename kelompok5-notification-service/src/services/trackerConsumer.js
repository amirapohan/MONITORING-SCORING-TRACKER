// RabbitMQ consumer for nexus integration.
// Subscribes to the tracker (svc-audit) event bus and records every event.
// Added for end-to-end integration; the HTTP /trigger endpoint still works.
import amqplib from "amqplib";
import { saveLog } from "../repositories/notificationRepo.js";
import { sendEmail } from "./emailService.js";

const RABBITMQ_URL =
  process.env.RABBITMQ_URL || "amqp://guest:guest@rabbit-main:5672";
const EXCHANGE = process.env.RABBITMQ_EXCHANGE || "tracker.events";
const EXCHANGE_TYPE = process.env.RABBITMQ_EXCHANGE_TYPE || "topic";
const QUEUE = process.env.RABBITMQ_QUEUE || "notify.tracker";
const BINDINGS = (process.env.RABBITMQ_BINDINGS || process.env.RABBITMQ_BINDING || "tracker.#,bidding.#")
  .split(",")
  .map((binding) => binding.trim())
  .filter(Boolean);
const RECONNECT_MS = 5000;

// Map a tracker event to the notify email model when it carries enough info.
function toEmailEvent(event) {
  const statusMap = {
    submission_approved: "ACCEPTED",
    submission_rejected: "REJECTED",
    bid_deal_confirmed: "ACCEPTED",
    bid_status_updated: event.status,
  };
  const status = statusMap[event.eventType] || event.status;
  if (!status || !event.email) return null;
  return {
    user_id: event.studentId || event.user_id,
    project_id: event.milestoneId || event.project_id || event.deal_id,
    status,
    email: event.email,
  };
}

async function connectAndConsume() {
  const connection = await amqplib.connect(RABBITMQ_URL);

  connection.on("error", () => {});
  connection.on("close", () => {
    console.warn(`[rabbit] connection closed, reconnecting in ${RECONNECT_MS}ms`);
    setTimeout(startTrackerConsumer, RECONNECT_MS);
  });

  const channel = await connection.createChannel();
  await channel.assertExchange(EXCHANGE, EXCHANGE_TYPE, { durable: true });
  await channel.assertQueue(QUEUE, { durable: true });
  for (const binding of BINDINGS) {
    await channel.bindQueue(QUEUE, EXCHANGE, binding);
  }
  await channel.prefetch(10);

  console.log(
    `[rabbit] notify consuming exchange=${EXCHANGE} queue=${QUEUE} keys=${BINDINGS.join(",")}`,
  );

  await channel.consume(QUEUE, async (msg) => {
    if (!msg) return;
    try {
      const event = JSON.parse(msg.content.toString());
      console.log(
        `[rabbit] event received routingKey=${msg.fields.routingKey} type=${event.eventType}`,
      );

      await saveLog(
        { source: "rabbitmq", routingKey: msg.fields.routingKey, ...event },
        "CONSUMED",
      );

      const emailEvent = toEmailEvent(event);
      if (emailEvent) {
        const result = await sendEmail(emailEvent);
        await saveLog(emailEvent, result);
      }

      channel.ack(msg);
    } catch (err) {
      console.error("[rabbit] failed to process message:", err);
      channel.nack(msg, false, false); // drop poison message
    }
  });
}

export async function startTrackerConsumer() {
  try {
    await connectAndConsume();
  } catch (err) {
    console.error(
      `[rabbit] connect failed, retry in ${RECONNECT_MS}ms: ${err.message}`,
    );
    setTimeout(startTrackerConsumer, RECONNECT_MS);
  }
}
