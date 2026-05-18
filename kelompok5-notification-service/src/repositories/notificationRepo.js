let logs = [];

export async function isDuplicate(event) {
  return logs.some(
    (log) =>
      log.user_id === event.user_id &&
      log.project_id === event.project_id &&
      log.status === event.status
  );
}

export async function saveLog(event, result) {
  logs.push({
    ...event,
    result,
    timestamp: new Date(),
  });

  console.log("Log tersimpan:", logs);
}