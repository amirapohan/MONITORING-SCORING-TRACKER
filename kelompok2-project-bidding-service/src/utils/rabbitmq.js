const amqp = require('amqplib');

let channel = null;
let connection = null;

const getConfig = () => ({
  url: process.env.RABBITMQ_URL || 'amqp://localhost',
  exchange: process.env.RABBITMQ_EXCHANGE || 'tracker.events',
  exchangeType: process.env.RABBITMQ_EXCHANGE_TYPE || 'topic',
  routingPrefix: process.env.RABBITMQ_ROUTING_PREFIX || 'bidding'
});

const connectRabbitMQ = async () => {
  try {
    const config = getConfig();
    connection = await amqp.connect(config.url);
    connection.on('close', () => {
      channel = null;
      connection = null;
    });
    connection.on('error', () => {
      channel = null;
      connection = null;
    });
    channel = await connection.createChannel();
    await channel.assertExchange(config.exchange, config.exchangeType, { durable: true });
    console.log('[RabbitMQ] Connected successfully');
  } catch (error) {
    console.error('[RabbitMQ] Connection failed:', error.message);
  }
};

const publishEvent = async (eventType, data) => {
  try {
    if (!channel || !connection) {
      await connectRabbitMQ();
    }

    if (!channel) {
      throw new Error('RabbitMQ channel is not available');
    }

    const config = getConfig();
    const routingKey = `${config.routingPrefix}.${eventType.replace(/_/g, '.')}`;
    const payload = {
      eventType,
      source: 'svc-bidding',
      publishedAt: new Date().toISOString(),
      ...data
    };

    channel.publish(
      config.exchange,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      {
        contentType: 'application/json',
        deliveryMode: 2,
        timestamp: Date.now(),
        type: eventType
      }
    );

    console.log(`[RabbitMQ] Published ${eventType} to ${config.exchange}:${routingKey}`);
    return true;
  } catch (error) {
    console.error(`[RabbitMQ] Failed to publish event ${eventType}:`, error.message);
    return false;
  }
};

const publishMessage = async (queueName, data) => {
  try {
    if (!channel) {
      await connectRabbitMQ();
    }
    
    await channel.assertQueue(queueName, { durable: true });
    
    const messageBuffer = Buffer.from(JSON.stringify(data));
    channel.sendToQueue(queueName, messageBuffer, { persistent: true });
    
    console.log(`[RabbitMQ] Sent message to ${queueName}`);
    return true;
  } catch (error) {
    console.error(`[RabbitMQ] Failed to send message to ${queueName}:`, error.message);
    return false;
  }
};

module.exports = { connectRabbitMQ, publishMessage, publishEvent };
