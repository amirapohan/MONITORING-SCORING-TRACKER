import express from "express";
import notificationRoutes from "./controllers/notificationController.js";
import { startTrackerConsumer } from "./services/trackerConsumer.js";

const app = express();
app.use(express.json());

app.use("/api/notifications", notificationRoutes);

// Health check for the nexus gateway / Docker healthcheck.
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "notification" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  // Start consuming tracker (svc-audit) events from RabbitMQ.
  startTrackerConsumer();
});