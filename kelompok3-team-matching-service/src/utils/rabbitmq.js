const amqplib = require("amqplib");

let connectionPromise = null;
let channelPromise = null;

function getConfig() {
  return {
    url: process.env.RABBITMQ_URL || "amqp://guest:guest@rabbit-main:5672",
    exchange: process.env.RABBITMQ_EXCHANGE || "tracker.events",
    exchangeType: process.env.RABBITMQ_EXCHANGE_TYPE || "topic",
    routingPrefix: process.env.RABBITMQ_ROUTING_PREFIX || "tracker",
  };
}

function resetConnectionState() {
  connectionPromise = null;
  channelPromise = null;
}

function buildRoutingKey(eventType) {
  const { routingPrefix } = getConfig();
  return `${routingPrefix}.${eventType.replace(/_/g, ".")}`;
}

async function getConnection() {
  if (!connectionPromise) {
    const { url } = getConfig();

    connectionPromise = amqplib.connect(url).then((connection) => {
      connection.on("error", () => {
        resetConnectionState();
      });

      connection.on("close", () => {
        resetConnectionState();
      });

      return connection;
    }).catch((error) => {
      resetConnectionState();
      throw error;
    });
  }

  return connectionPromise;
}

async function getChannel() {
  if (!channelPromise) {
    channelPromise = (async () => {
      const connection = await getConnection();
      const channel = await connection.createChannel();
      const { exchange, exchangeType } = getConfig();

      await channel.assertExchange(exchange, exchangeType, {
        durable: true,
      });

      return channel;
    })().catch((error) => {
      channelPromise = null;
      throw error;
    });
  }

  return channelPromise;
}

async function publishEvent(eventType, payload) {
  const channel = await getChannel();
  const { exchange } = getConfig();
  const routingKey = buildRoutingKey(eventType);
  const body = Buffer.from(JSON.stringify(payload));

  channel.publish(exchange, routingKey, body, {
    contentType: "application/json",
    deliveryMode: 2,
    timestamp: Date.now(),
    type: eventType,
  });

  return { exchange, routingKey };
}

async function connect() {
  await getChannel();
  const { exchange, url } = getConfig();
  console.log(`[RabbitMQ] Connected to ${url}, exchange: ${exchange}`);
}

async function close() {
  try {
    if (connectionPromise) {
      const connection = await connectionPromise;
      await connection.close();
    }
  } catch (err) {
    // ignore errors on close
  } finally {
    resetConnectionState();
  }
}

async function subscribe(exchange, exchangeType, queueName, routingKeys, handler) {
  const connection = await getConnection();
  const channel = await connection.createChannel();

  await channel.assertExchange(exchange, exchangeType, { durable: true });
  await channel.assertQueue(queueName, { durable: true });

  for (const key of routingKeys) {
    await channel.bindQueue(queueName, exchange, key);
  }

  await channel.prefetch(10);

  await channel.consume(queueName, async (msg) => {
    if (!msg) return;
    let payload;
    try {
      payload = JSON.parse(msg.content.toString());
    } catch {
      channel.nack(msg, false, false);
      return;
    }
    try {
      await handler(payload);
      channel.ack(msg);
    } catch (err) {
      console.error(`[RabbitMQ] consumer error on ${queueName}:`, err.message);
      channel.nack(msg, false, true);
    }
  });

  console.log(`[RabbitMQ] Subscribed — exchange: ${exchange}, queue: ${queueName}`);
}

module.exports = {
  buildRoutingKey,
  getConfig,
  publishEvent,
  subscribe,
  connect,
  close,
};
