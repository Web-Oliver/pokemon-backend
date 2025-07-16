const mongoose = require('mongoose');

// Centralized error handling middleware following Express.js best practices
const errorHandler = (err, req, res, next) => {
  // If response headers have already been sent, delegate to the default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  // Default error
  const error = {
    status: 'error',
    message: 'Internal Server Error',
    statusCode: 500,
  };

  // Handle different error types
  if (err.name === 'ValidationError') {
    // Mongoose validation error
    error.statusCode = 400;
    error.message = 'Validation Error';
    error.details = Object.values(err.errors).map((e) => e.message);
  } else if (err.name === 'CastError') {
    // Mongoose cast error (invalid ObjectId, etc.)
    error.statusCode = 400;
    error.message = 'Invalid ID format';
  } else if (err.code === 11000) {
    // MongoDB duplicate key error
    error.statusCode = 400;
    error.message = 'Duplicate field value';
    const field = Object.keys(err.keyPattern)[0];

    error.details = `${field} already exists`;
  } else if (err.statusCode || err.status) {
    // Custom error with status code
    error.statusCode = err.statusCode || err.status;
    error.message = err.message;
  } else if (err.message) {
    // General error with message
    error.message = err.message;
  }

  // Log error in development
  if (process.env.NODE_ENV !== 'production') {
    console.error('=== ERROR HANDLER ===');
    console.error('Error caught by middleware:', err.message);
    console.error('Error name:', err.name);
    console.error('Error code:', err.code);
    console.error('Stack trace:', err.stack);
    console.error('Request method:', req.method);
    console.error('Request path:', req.path);
    console.error('Request body:', JSON.stringify(req.body, null, 2));
    console.error('==================');
    console.error('Error:', err);
  }

  // Send error response
  res.status(error.statusCode).json({
    success: false,
    status: error.status,
    message: error.message,
    ...error.details && { details: error.details },
    ...process.env.NODE_ENV !== 'production' && { stack: err.stack },
  });
};

// Async error wrapper to catch async errors and pass to error handler
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Custom error classes
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

module.exports = {
  errorHandler,
  asyncHandler,
  AppError,
  ValidationError,
  NotFoundError,
};
