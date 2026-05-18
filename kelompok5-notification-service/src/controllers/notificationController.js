import express from "express";
import { handleNotificationEvent } from "../services/notificationService.js";

const router = express.Router();

// endpoint untuk testing manual
router.post("/trigger", async (req, res) => {
  const event = req.body;

  await handleNotificationEvent(event);

  res.json({ message: "Notification processed" });
});

export default router;