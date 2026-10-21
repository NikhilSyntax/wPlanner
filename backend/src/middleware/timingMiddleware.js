/**
 * Lightweight, production-safe performance timing middleware.
 * Uses high-resolution process.hrtime.bigint() to measure request duration.
 * Attaches X-Response-Time header and logs structured timing with route templates.
 */

function performanceTimingMiddleware(req, res, next) {
  const startHrTime = process.hrtime.bigint();

  // Patch res.writeHead to attach X-Response-Time before headers are flushed
  const originalWriteHead = res.writeHead;
  res.writeHead = function (...args) {
    if (!res.headersSent) {
      const elapsedNs = process.hrtime.bigint() - startHrTime;
      const elapsedMs = Number(elapsedNs) / 1e6;
      res.setHeader('X-Response-Time', `${elapsedMs.toFixed(2)}ms`);
    }
    return originalWriteHead.apply(this, args);
  };

  res.on('finish', () => {
    // Only log API routes to keep logs clean and avoid flooding
    if (!req.originalUrl || !req.originalUrl.startsWith('/api')) {
      return;
    }

    const elapsedNs = process.hrtime.bigint() - startHrTime;
    const elapsedMs = (Number(elapsedNs) / 1e6).toFixed(1);

    // Prefer route template path to avoid logging sensitive query params
    const routeTemplate = req.baseUrl ? `${req.baseUrl}${req.route?.path || ''}` : (req.route?.path || req.path);

    // Structured, safe log (no query params, bodies, tokens, or credentials)
    console.log(`[PERF] ${req.method} ${routeTemplate || req.path} ${res.statusCode} ${elapsedMs}ms`);
  });

  next();
}

module.exports = { performanceTimingMiddleware };
