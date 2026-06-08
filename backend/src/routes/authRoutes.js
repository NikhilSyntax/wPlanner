const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

// Register
router.post("/register", authController.register);

// Login
router.post("/login", authController.login);

// Current user
router.get("/me", authMiddleware.verifyToken, authController.me);

// Refresh token
router.post("/refresh", authController.refresh);

// Logout
router.post("/logout", authController.logout);

// OAuth callbacks
router.get("/auth/google/callback", authController.oauthCallback("google"));
router.get("/auth/github/callback", authController.oauthCallback("github"));
router.get(
  "/auth/microsoft/callback",
  authController.oauthCallback("microsoft"),
);

module.exports = router;
