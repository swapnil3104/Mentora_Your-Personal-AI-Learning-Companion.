const jwt = require('jsonwebtoken');
const config = require('../config/environment');
const prisma = require('../config/database');
const { unauthorized } = require('../utils/api-response');

/**
 * Authentication Middleware
 * Protects routes requiring user authentication.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorized(res, 'Authentication token required');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return unauthorized(res, 'Authentication token missing');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return unauthorized(res, 'Authentication token has expired');
      }
      return unauthorized(res, 'Invalid authentication token');
    }

    // Verify user exists in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    if (!user) {
      return unauthorized(res, 'User no longer exists');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  authenticate,
  requireAuth: authenticate,
};

