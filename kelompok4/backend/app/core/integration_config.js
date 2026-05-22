// Sakelar untuk validasi integrasi lintas-service (K4 -> K1/K2).
//
// Default OFF supaya aman untuk deployment live & data/test lama: tanpa flag,
// milestone/submission tetap menerima ID apa adanya (perilaku lama). Saat
// VALIDATE_INTEGRATION=true, K4 memverifikasi employer/talent ke K1 dan
// (bila projectId disertakan) keterkaitan project + awarding ke K2.
function isIntegrationValidationEnabled() {
  return String(process.env.VALIDATE_INTEGRATION || "").trim().toLowerCase() === "true";
}

module.exports = {
  isIntegrationValidationEnabled,
};
