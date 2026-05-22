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
