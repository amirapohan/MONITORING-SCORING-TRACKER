class ApiError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function validationError(message) {
  return new ApiError(400, "VALIDATION_ERROR", message);
}

function notFoundError(message) {
  return new ApiError(404, "NOT_FOUND", message);
}

function conflictError(message) {
  return new ApiError(409, "CONFLICT", message);
}

function forbiddenError(message) {
  return new ApiError(403, "FORBIDDEN", message);
}

function buildErrorResponse(error) {
  return {
    error: {
      code: error.code || "INTERNAL_SERVER_ERROR",
      message: error.message || "Internal server error",
      timestamp: new Date().toISOString(),
    },
  };
}

module.exports = {
  ApiError,
  validationError,
  notFoundError,
  conflictError,
  forbiddenError,
  buildErrorResponse,
};
