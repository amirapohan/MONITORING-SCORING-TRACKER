const amqplib = require("amqplib");

const URL =
  process.env.AMQP_URL ||
  "amqp://guest:guest@map-sandbox.tailcbdd04.ts.net:5672";
const EXCHANGE = process.env.AMQP_EXCHANGE || "tracker.events";
const EXCHANGE_TYPE = process.env.AMQP_EXCHANGE_TYPE || "topic";
const QUEUE = process.env.AMQP_QUEUE || "test.amqp.script";
const BINDING = process.env.AMQP_BINDING || "tracker.#";

function buildSamplePayload() {
  return {
    eventType: "milestone_created",
    milestoneId: `test-${Date.now()}`,
    employerId: "emp-nexus-01",
    studentId: "stu-nexus-01",
    status: "open",
    deadline: "2026-06-30T17:00:00.000Z",
    occurredAt: new Date().toISOString(),
  };
}

async function publish() {
  console.log(`[publish] connecting to ${URL}`);
  const connection = await amqplib.connect(URL);
  const channel = await connection.createChannel();

  await channel.assertExchange(EXCHANGE, EXCHANGE_TYPE, { durable: true });

  const payload = buildSamplePayload();
  const routingKey = "tracker.milestone.created";

  channel.publish(
    EXCHANGE,
    routingKey,
    Buffer.from(JSON.stringify(payload)),
    { contentType: "application/json", deliveryMode: 2, type: payload.eventType },
  );

  console.log(`[publish] sent exchange=${EXCHANGE} routingKey=${routingKey}`);
  console.log(`[publish] payload=${JSON.stringify(payload)}`);

  await channel.close();
  await connection.close();
  console.log("[publish] done");
}

async function consume() {
  console.log(`[consume] connecting to ${URL}`);
  const connection = await amqplib.connect(URL);
  const channel = await connection.createChannel();

  await channel.assertExchange(EXCHANGE, EXCHANGE_TYPE, { durable: true });
  await channel.assertQueue(QUEUE, { durable: true });
  await channel.bindQueue(QUEUE, EXCHANGE, BINDING);
  await channel.prefetch(10);

  console.log(
    `[consume] waiting on exchange=${EXCHANGE} queue=${QUEUE} binding=${BINDING}`,
  );
  console.log("[consume] press Ctrl+C to stop");

  await channel.consume(QUEUE, (msg) => {
    if (!msg) return;
    const body = msg.content.toString();
    let parsed = body;
    try {
      parsed = JSON.parse(body);
    } catch (_) {
      // leave as string
    }
    console.log(
      `[consume] received routingKey=${msg.fields.routingKey} type=${msg.properties.type || "?"}`,
    );
    console.log(`[consume] payload=${JSON.stringify(parsed)}`);
    channel.ack(msg);
  });
}

async function main() {
  const mode = process.argv[2];

  if (mode === "publish") {
    await publish();
    return;
  }

  if (mode === "consume") {
    await consume();
    return;
  }

  console.log("usage: node test-amqp.js publish|consume");
  console.log("env overrides: AMQP_URL, AMQP_EXCHANGE, AMQP_QUEUE, AMQP_BINDING");
  process.exit(1);
}

main().catch((err) => {
  console.error("[error]", err && err.message ? err.message : err);
  process.exit(1);
});
