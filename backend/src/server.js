const express = require("express");
const cors = require("cors");
const compression = require("compression");
const path = require("path");
const fs = require("fs");
const { connectMongo } = require("./config/mongo");
const config = require("./config/config")();
const authRoutes = require("./routes/authRoutes");
const eventRoutes = require("./routes/eventRoutes");
const teamRoutes = require("./routes/teamRoutes");
const userRoutes = require("./routes/userRoutes");
const songRoutes = require("./routes/songRoutes");
const chatRoutes = require("./routes/chatRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const churchRoutes = require("./routes/churchRoutes");
const { createServer } = require("./sockets/socketServer");
const { apiLimiter, authLimiter } = require("./middleware/rateLimiter");
const { helmetConfig, sanitizeInput } = require("./middleware/security");
const { getRedisClient } = require("./config/redis");

const app = express();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("Created uploads directory:", uploadsDir);
}

// Security middleware
app.use(helmetConfig);
app.use(sanitizeInput);

// Rate limiting
app.use("/api/", apiLimiter);
app.use("/api/auth", authLimiter);

// Middleware
app.use(cors(config.cors));
app.use(express.json());
app.use(compression());

// Serve uploaded files with CORS headers
app.use(
  "/uploads",
  (req, res, next) => {
    // Set CORS headers for uploaded files
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Credentials", "false");
    // Allow cross-origin image loading
    res.header("Cross-Origin-Resource-Policy", "cross-origin");
    res.header("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    next();
  },
  express.static(uploadsDir, {
    maxAge: "1h",
    etag: false, // Disable ETag to force fresh downloads
  }),
);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
// Other API routes
app.use("/api/teams", teamRoutes);
app.use("/api/users", userRoutes);
app.use("/api/songs", songRoutes);
app.use("/api/church", churchRoutes);
// Chat routes for event real‑time messaging (REST fallback)
app.use("/api/events", chatRoutes);
// Notification routes
app.use("/api/notifications", notificationRoutes);

// Health check
app.get("/health", async (req, res) => {
  // Check Redis connectivity
  let redisStatus = "ok";
  try {
    const client = await getRedisClient();
    await client.ping();
  } catch (e) {
    redisStatus = "error";
  }
  res.json({ status: "ok", redis: redisStatus });
});

// Connect to MongoDB then start server
(async () => {
  await connectMongo();

  const server = createServer(app);

  // Set up Socket.IO Redis adapter (if Redis available)
  try {
    const { createAdapter } = require("@socket.io/redis-adapter");
    const pubClient = await getRedisClient();
    const subClient = pubClient.duplicate();
    server.io.adapter(createAdapter(pubClient, subClient));
    console.log("Socket.IO Redis adapter attached");
  } catch (e) {
    console.log("Redis adapter not available, using default adapter");
  }

  server.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });
})();
