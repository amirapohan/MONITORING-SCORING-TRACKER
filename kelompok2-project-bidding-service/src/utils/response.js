/**
 * Response Utilities
 * 
 * File ini menyediakan standardized response format untuk semua endpoint.
 * Ini memastikan consistency di seluruh API, sehingga client tahu apa yang diharapkan.
 */

/**
 * Send Success Response
 * 
 * @param {Object} res - Express response object
 * @param {string} message - Success message
 * @param {Object} data - Response data (optional)
 * @param {number} statusCode - HTTP status code (default: 200)
 * @returns {void}
 * 
 * @example
 * responseSuccess(res, 'Bids retrieved', bidsArray, 200);
 */
const responseSuccess = (res, message, data = null, statusCode = 200) => {
  const response = {
    success: true,
    message: message
  };

  if (data !== null) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

/**
 * Send Error Response
 * 
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {string} code - Error code untuk debugging (optional)
 * @param {Object} details - Additional error details (optional)
 * @returns {void}
 * 
 * @example
 * responseError(res, 'User not found', 404, 'USER_NOT_FOUND');
 * responseError(res, 'Validation failed', 400, 'VALIDATION_ERROR', {field: 'email'});
 */
const responseError = (res, message, statusCode = 500, code = 'ERROR', details = null) => {
  const response = {
    success: false,
    message: message,
    code: code
  };

  if (details !== null) {
    response.details = details;
  }

  return res.status(statusCode).json(response);
};

module.exports = {
  responseSuccess,
  responseError
};
