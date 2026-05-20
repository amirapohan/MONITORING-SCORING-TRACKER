const rabbitmq = require('../utils/rabbitmq');
const eventLogRepository = require('../repositories/eventLogRepository');

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
}

function getRetryConfig() {
  return {
    retries: parsePositiveInteger(process.env.RABBITMQ_PUBLISH_RETRIES, 3),
    retryDelayMs: parsePositiveInteger(process.env.RABBITMQ_PUBLISH_RETRY_DELAY_MS, 200),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error) {
  if (!error) return 'unknown error';
  if (typeof error.message === 'string' && error.message.trim()) return error.message;
  return String(error);
}

function buildPayload(eventType, payload = {}) {
  return {
    ...payload,
    eventType,
    occurredAt: typeof payload.occurredAt === 'string' && payload.occurredAt.trim()
      ? payload.occurredAt
      : new Date().toISOString(),
  };
}

async function publishToEventLog(eventType, payload) {
  const messagePayload = buildPayload(eventType, payload);
  const eventLog = await eventLogRepository.createEventLog(eventType, messagePayload);

  const { retries, retryDelayMs } = getRetryConfig();
  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const publishResult = await rabbitmq.publishEvent(eventType, messagePayload);
      const sentLog = await eventLogRepository.updateEventLogStatus(eventLog.id, 'sent');

      return { ...sentLog, exchange: publishResult.exchange, routingKey: publishResult.routingKey };
    } catch (error) {
      lastError = error;
      console.error(
        `[event-publisher] publish failed event_log=${eventLog.id} eventType=${eventType} attempt=${attempt}/${retries}: ${getErrorMessage(error)}`
      );
      if (attempt < retries) await sleep(retryDelayMs);
    }
  }

  await eventLogRepository.updateEventLogStatus(eventLog.id, 'failed');
  console.error(
    `[event-publisher] Marked event_log=${eventLog.id} as failed after ${retries} attempts: ${getErrorMessage(lastError)}`
  );

  return { ...eventLog, payload: messagePayload, status: 'failed' };
}

module.exports = { publishToEventLog };
