import { getPublishChannel } from "./connection";
import { EXCHANGE, ROUTING_KEYS, type EventMessage } from "./eventTypes";

export const publishEvent = (message: EventMessage): Promise<void> => {
  const ch = getPublishChannel();
  const routingKey = ROUTING_KEYS[message.eventType];
  const content = Buffer.from(JSON.stringify(message));

  return new Promise((resolve, reject) => {
    ch.publish(EXCHANGE, routingKey, content, { persistent: true, contentType: "application/json" },
      (err) => {
        if (err) reject(err);
        else resolve();
      },
    );
  });
};
