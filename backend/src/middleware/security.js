const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");

// Helmet configuration for security headers
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "http://localhost:5173"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
});

// Input sanitization to prevent NoSQL injection
const sanitizeInput = mongoSanitize({
  replaceWith: "_",
});

module.exports = { helmetConfig, sanitizeInput };
