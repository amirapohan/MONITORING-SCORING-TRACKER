import express from "express";
import { handleNotificationEvent } from "../services/notificationService.js";
import { getLogs } from "../repositories/notificationRepo.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const logs = await getLogs();
  res.json({ data: logs });
});

// endpoint untuk testing manual
router.post("/trigger", async (req, res) => {
  const event = req.body;

  await handleNotificationEvent(event);

  res.json({ message: "Notification processed" });
});

export default router;