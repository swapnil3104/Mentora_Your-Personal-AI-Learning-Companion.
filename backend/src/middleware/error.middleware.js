const { error } = require('../utils/api-response');

/**
 * Centralized Error Handling Middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('[Error Handler]', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.originalUrl,
    method: req.method,
  });

  // Handle Prisma Known Request Errors
  if (err.code === 'P2002') {
    return error(res, 'A record with this value already exists', 409, {
      target: err.meta?.target,
    });
  }

  if (err.code === 'P2025') {
    return error(res, 'Record not found in database', 404);
  }

  // Handle validation or bad request errors
  if (err.status) {
    return error(res, err.message, err.status, err.details || null);
  }

  // Generic fallback
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  return error(res, message, statusCode);
};

module.exports = {
  errorHandler,
};

