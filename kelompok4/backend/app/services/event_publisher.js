const events = [];
const eventLogRepository = require("../repositories/event_log_repo");
const rabbitMq = require("../core/rabbitmq");

function publish(eventName, payload) {
  const event = {
    id: `event-${events.length + 1}`,
    eventName,
    payload,
    status: "pending",
    publishedAt: new Date().toISOString(),
  };

  events.push(event);

  return event;
}

function listEvents() {
  return [...events];
}

function parsePositiveInteger(value, fallbackValue) {
  const parsedValue = Number.parseInt(value, 10);

  if (Number.isNaN(parsedValue) || parsedValue <= 0) {
    return fallbackValue;
  }

  return parsedValue;
}

function getRetryConfig() {
  return {
    retries: parsePositiveInteger(process.env.RABBITMQ_PUBLISH_RETRIES, 3),
    retryDelayMs: parsePositiveInteger(process.env.RABBITMQ_PUBLISH_RETRY_DELAY_MS, 200),
  };
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function getErrorMessage(error) {
  if (!error) {
    return "unknown error";
  }

  if (typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }

  if (Array.isArray(error.errors) && error.errors.length > 0) {
    return error.errors
      .map((nestedError) => nestedError && nestedError.message)
      .filter(Boolean)
      .join(" | ");
  }

  return String(error);
}

function buildMessagePayload(eventType, payload = {}) {
  return {
    ...payload,
    eventType,
    occurredAt:
      typeof payload.occurredAt === "string" && payload.occurredAt.trim()
        ? payload.occurredAt
        : new Date().toISOString(),
  };
}

async function publishToEventLog(eventType, payload) {
  const messagePayload = buildMessagePayload(eventType, payload);
  const eventLog = await eventLogRepository.createEventLog({
    eventType,
    payload: messagePayload,
    status: "pending",
  });

  const { retries, retryDelayMs } = getRetryConfig();
  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const publishResult = await rabbitMq.publishEvent(eventType, messagePayload);
      const sentEventLog = await eventLogRepository.updateEventLogStatus(eventLog.id, "sent");

      return {
        ...sentEventLog,
        exchange: publishResult.exchange,
        routingKey: publishResult.routingKey,
      };
    } catch (error) {
      lastError = error;
      const errorMessage = getErrorMessage(error);

      console.error(
        `[event-publisher] RabbitMQ publish failed for event_log=${eventLog.id} eventType=${eventType} attempt=${attempt}/${retries}: ${errorMessage}`,
      );

      if (attempt < retries) {
        await sleep(retryDelayMs);
      }
    }
  }

  await eventLogRepository.updateEventLogStatus(eventLog.id, "failed");

  console.error(
    `[event-publisher] Marked event_log=${eventLog.id} as failed after ${retries} publish attempts: ${getErrorMessage(lastError)}`,
  );

  return {
    ...eventLog,
    payload: messagePayload,
    status: "failed",
  };
}

module.exports = {
  publish,
  listEvents,
  publishToEventLog,
};
