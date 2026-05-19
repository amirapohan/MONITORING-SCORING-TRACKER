const amqp = require('amqplib');

let channel = null;

const connectRabbitMQ = async () => {
  try {
    // Akan konek ke URL RabbitMQ (atur RABBITMQ_URL di .env nanti)
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    channel = await connection.createChannel();
    console.log('[RabbitMQ] Connected successfully');
  } catch (error) {
    console.error('[RabbitMQ] Connection failed:', error.message);
  }
};

const publishMessage = async (queueName, data) => {
  try {
    if (!channel) {
      await connectRabbitMQ();
    }
    
    // Pastikan nama antrean siap
    await channel.assertQueue(queueName, { durable: true });
    
    // Kirim data dalam bentuk Buffer (syarat wajib RabbitMQ)
    const messageBuffer = Buffer.from(JSON.stringify(data));
    channel.sendToQueue(queueName, messageBuffer, { persistent: true });
    
    console.log(`[RabbitMQ] Sent message to ${queueName}`);
    return true;
  } catch (error) {
    console.error(`[RabbitMQ] Failed to send message to ${queueName}:`, error.message);
    return false;
  }
};

module.exports = { connectRabbitMQ, publishMessage };
