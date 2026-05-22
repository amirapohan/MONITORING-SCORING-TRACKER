import { sendEmail } from "./emailService.js";
import { saveLog, isDuplicate } from "../repositories/notificationRepo.js";

export async function handleNotificationEvent(event) {
  console.log("Event masuk:", event);

  const normalizedEvent = {
    ...event,
    user_id: event.user_id || event.recipient_id,
    project_id: event.project_id || event.deal_id,
    status: event.status,
  };

  // 1. Validasi sederhana
  if (!normalizedEvent.user_id || !normalizedEvent.status) {
    console.log("Event tidak valid");
    return;
  }

  // 2. Filter status
  if (!["ACCEPTED", "REJECTED"].includes(normalizedEvent.status)) {
    console.log("Status tidak perlu notifikasi");
    await saveLog(normalizedEvent, "IGNORED");
    return;
  }

  // 3. Cek duplikat (sementara dummy)
  const duplicate = await isDuplicate(normalizedEvent);
  if (duplicate) {
    console.log("Duplicate event, skip");
    return;
  }

  if (!normalizedEvent.email) {
    console.log("Event tidak memiliki email, disimpan sebagai log saja");
    await saveLog(normalizedEvent, "NO_EMAIL");
    return;
  }

  // 4. Kirim email
  const result = await sendEmail(normalizedEvent);

  // 5. Simpan log
  await saveLog(normalizedEvent, result);

  console.log("Selesai proses notifikasi");
}
