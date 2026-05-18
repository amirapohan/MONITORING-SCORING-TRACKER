import type { NextFunction, Request, Response } from "express";

import { AppError } from "../types/errors";

type ErrorWithStatusCode = Error & {
  statusCode?: number;
  errors?: unknown;
  code?: string;
};

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction) => {
  const error: ErrorWithStatusCode = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

export const errorHandler = (
  err: ErrorWithStatusCode,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  let statusCode = err.statusCode ?? 500;
  let message = err.message || "Internal Server Error";

  if (err instanceof AppError) {
    statusCode = err.statusCode;
  }

  if (err.code === "P2002") {
    statusCode = 409;
    message = "Resource already exists";
  }

  if (process.env.NODE_ENV === "development") {
    console.error("Error:", {
      message: err.message,
      stack: err.stack,
      statusCode,
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {}),
    ...(err.errors ? { errors: err.errors } : {}),
  });
};
