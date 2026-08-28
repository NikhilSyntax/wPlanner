const rateLimit = require('express-rate-limit');

// General API rate limiter (generous limit to support real-time polling)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // allow up to 5000 requests per 15 minutes
  message: { message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiter for auth endpoints (prevents brute force but does not block legitimate users)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // allow up to 100 auth attempts per 15 minutes
  skipSuccessfulRequests: true, // Only failed login attempts count against the limit
  message: { message: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { apiLimiter, authLimiter };
