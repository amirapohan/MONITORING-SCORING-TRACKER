import type { NextFunction, Request, Response } from "express";

import { config } from "../config";

const internalApiKey = (req: Request, res: Response, next: NextFunction) => {
  if (!config.internalApiKey) {
    return res.status(503).json({
      success: false,
      message: "Internal API key is not configured",
    });
  }

  const apiKey = req.header("x-internal-api-key");

  if (apiKey !== config.internalApiKey) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Invalid internal API key",
    });
  }

  next();
};

export default internalApiKey;
