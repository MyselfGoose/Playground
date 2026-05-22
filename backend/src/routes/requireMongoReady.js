import mongoose from 'mongoose';

/** @returns {boolean} */
export function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

/**
 * Gate DB-backed routes until Mongo is connected (readyState === 1).
 * OPTIONS requests pass through for CORS preflight.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function requireMongoReady(req, res, next) {
  if (req.method === 'OPTIONS') {
    return next();
  }
  if (isMongoReady()) {
    return next();
  }
  return res.status(503).json({
    error: {
      message: 'Database is not ready',
      code: 'MONGODB_NOT_READY',
    },
    mongoReadyState: mongoose.connection.readyState,
  });
}
