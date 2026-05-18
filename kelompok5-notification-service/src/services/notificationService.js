import { sendEmail } from "./emailService.js";
import { saveLog, isDuplicate } from "../repositories/notificationRepo.js";

export async function handleNotificationEvent(event) {
  console.log("Event masuk:", event);

  // 1. Validasi sederhana
  if (!event.user_id || !event.status || !event.email) {
    console.log("Event tidak valid");
    return;
  }

  // 2. Filter status
  if (!["ACCEPTED", "REJECTED"].includes(event.status)) {
    console.log("Status tidak perlu notifikasi");
    return;
  }

  // 3. Cek duplikat (sementara dummy)
  const duplicate = await isDuplicate(event);
  if (duplicate) {
    console.log("Duplicate event, skip");
    return;
  }

  // 4. Kirim email
  const result = await sendEmail(event);

  // 5. Simpan log
  await saveLog(event, result);

  console.log("Selesai proses notifikasi");
}