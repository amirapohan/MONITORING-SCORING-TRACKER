import app from "./app";
import { config } from "./config";
import { prisma } from "./models/prisma";

const start = async () => {
  try {
    await prisma.$connect();
    console.log("Database connection established successfully.");

    const server = app.listen(config.port, () => {
      console.log(`identity-and-sso-service running on port ${config.port}`);
      console.log(`Health check: http://localhost:${config.port}/health`);
      console.log(`Environment: ${config.nodeEnv}`);
    });

    const shutdown = async (signal: string) => {
      console.log(`${signal} received. Shutting down gracefully...`);

      server.close(async () => {
        console.log("HTTP server closed.");

        try {
          await prisma.$disconnect();
          console.log("Database connection closed.");
        } catch (error) {
          console.error("Error closing database:", error);
        }

        process.exit(0);
      });

      setTimeout(() => {
        console.error("Forcing shutdown...");
        process.exit(1);
      }, 10_000);
    };

    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT", () => void shutdown("SIGINT"));
  } catch (error) {
    console.error("Unable to start server:", error);
    process.exit(1);
  }
};

void start();
