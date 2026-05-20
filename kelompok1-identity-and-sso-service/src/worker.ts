import { prisma } from "./models/prisma";
import { closeRabbitMQ, connectRabbitMQ } from "./messaging/connection";
import { assertTopology } from "./messaging/topology";
import { startAuditConsumer } from "./consumers/auditConsumer";
import { startOutboxRelay, stopOutboxRelay } from "./services/outboxRelay";

const start = async () => {
  console.log("[Worker] starting...");
  await prisma.$connect();
  console.log("[Worker] database connected");
  await connectRabbitMQ();
  await assertTopology();
  await startAuditConsumer();
  startOutboxRelay();
  console.log("[Worker] ready");
};

const shutdown = async (signal: string) => {
  console.log(`[Worker] received ${signal}, shutting down...`);
  stopOutboxRelay();
  await closeRabbitMQ();
  await prisma.$disconnect();
  console.log("[Worker] shutdown complete");
  process.exit(0);
};

const forceExit = setTimeout(() => process.exit(1), 10_000);
forceExit.unref();

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start().catch((err) => {
  console.error("[Worker] startup failed:", err);
  process.exit(1);
});
