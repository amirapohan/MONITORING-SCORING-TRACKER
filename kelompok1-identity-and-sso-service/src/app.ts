import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { config } from "./config";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import internalApiKey from "./middlewares/internalApiKey";
import routes from "./routes";
import internalRoutes from "./routes/internal.routes";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // No origin = server-to-server or curl; not a browser request, always allow
      if (!origin) return callback(null, true);

      // Empty whitelist in non-production: allow all browser origins (dev convenience)
      // Empty whitelist in production: block all browser origins (forces explicit config)
      if (config.corsAllowedOrigins.length === 0) {
        return callback(null, config.nodeEnv !== "production");
      }

      callback(null, config.corsAllowedOrigins.includes(origin));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
if (config.nodeEnv !== "test") {
  app.use(morgan(config.nodeEnv === "development" ? "dev" : "combined"));
}

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
    service: "identity-and-sso-service",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use("/api", routes);
app.use("/internal", internalApiKey, internalRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
