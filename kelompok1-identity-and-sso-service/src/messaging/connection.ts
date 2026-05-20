import amqp from "amqplib";

import { config } from "../config";

let connection: amqp.ChannelModel | null = null;
let publishChannel: amqp.ConfirmChannel | null = null;
let consumeChannel: amqp.Channel | null = null;

export const connectRabbitMQ = async (): Promise<void> => {
  connection = await amqp.connect(config.rabbitmqUrl);
  publishChannel = await connection.createConfirmChannel();
  consumeChannel = await connection.createChannel();

  connection.on("error", (err: Error) => {
    console.error("[RabbitMQ] connection error:", err.message);
  });
  connection.on("close", () => {
    console.error("[RabbitMQ] connection closed");
  });

  console.log("[RabbitMQ] connected");
};

export const getPublishChannel = (): amqp.ConfirmChannel => {
  if (!publishChannel) throw new Error("RabbitMQ publish channel not initialized");
  return publishChannel;
};

export const getConsumeChannel = (): amqp.Channel => {
  if (!consumeChannel) throw new Error("RabbitMQ consume channel not initialized");
  return consumeChannel;
};

export const closeRabbitMQ = async (): Promise<void> => {
  try {
    await publishChannel?.close();
    await consumeChannel?.close();
    await connection?.close();
    console.log("[RabbitMQ] connection closed gracefully");
  } catch {
    // ignore errors during shutdown
  }
};
