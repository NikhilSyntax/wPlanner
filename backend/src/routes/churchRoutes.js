// routes/churchRoutes.js
const express = require("express");
const router = express.Router();
const churchController = require("../controllers/churchController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware.verifyToken);

// Create a new church (admin becomes creator)
router.post("/create", churchController.createChurch);

// Join an existing church by code
router.post("/join", churchController.joinChurch);
router.post("/resubmit-request", churchController.resubmitJoinRequest);

// Get members of current church (admin or member)
router.get("/members", churchController.getMembers);
router.delete(
  "/members/:userId",
  authMiddleware.adminOnly,
  churchController.removeMemberFromRoster,
);
// Toggle availability for current user
router.patch("/members/availability", churchController.setAvailability);
router.get("/current", churchController.getCurrentChurch);

// Admin review flow for join requests
router.get("/requests/pending", churchController.getPendingRequests);
router.patch("/requests/:userId", churchController.reviewJoinRequest);

module.exports = router;
