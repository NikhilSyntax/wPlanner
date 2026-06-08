// controllers/churchController.js
const Church = require("../models/Church");
const User = require("../models/User");
const Team = require("../models/Team");
const { activeConnections } = require("../sockets/socketServer");
const { generateUniqueChurchCode } = require("../utils/churchUtils");
const authConfig = require("../config/auth");

// NOTE: Team assignment is intentionally manual (admin adds users to teams).

async function generateTokens(user) {
  const accessToken = authConfig.createJWT(user);
  const refreshToken = authConfig.createRefreshToken(user);
  user.refreshTokens = user.refreshTokens || [];
  user.refreshTokens.push(refreshToken);
  await user.save();
  return { accessToken, refreshToken };
}

/**
 * Create a new church. The requesting user becomes admin.
 * Expected body: { name }
 */
exports.createChurch = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: "Church name required" });
  try {
    const code = await generateUniqueChurchCode();
    const church = await Church.create({
      name,
      churchCode: code,
      createdBy: req.user.userId,
    });
    // Update user to be admin of this new church
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { churchId: church._id, isAdmin: true },
      { new: true },
    );
    const tokens = await generateTokens(user);
    res.status(201).json({
      churchId: church._id,
      churchCode: church.churchCode,
      user,
      ...tokens,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Join an existing church via code.
 * Expected body: { churchCode }
 */
exports.joinChurch = async (req, res) => {
  const { churchCode } = req.body;
  if (!churchCode)
    return res.status(400).json({ message: "Church code required" });
  try {
    const normalizedChurchCode = churchCode.trim().toUpperCase();
    const church = await Church.findOne({ churchCode: normalizedChurchCode });
    if (!church)
      return res.status(400).json({ message: "Invalid church code" });
    // Update user
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        churchId: church._id,
        isAdmin: false,
        approvalStatus: "pending",
        approvedAt: null,
      },
      { new: true },
    );
    const tokens = await generateTokens(user);
    res.json({
      message: "Join request submitted. Awaiting admin approval.",
      churchId: church._id,
      user,
      ...tokens,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * User was rejected or removed from roster: set status back to pending so
 * admins can review again. Requires an existing churchId on the account.
 */
exports.resubmitJoinRequest = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.approvalStatus !== "rejected") {
      return res.status(400).json({
        message:
          "You can only resubmit after a request was declined. If you are still waiting, ask your admin to approve you.",
      });
    }
    if (!user.churchId) {
      return res.status(400).json({
        message:
          "No church is linked to your account. Ask your admin for a join code.",
      });
    }

    user.approvalStatus = "pending";
    user.approvedAt = undefined;
    await user.save();

    const tokens = await generateTokens(user);
    res.json({
      message: "Join request resubmitted. Awaiting admin approval.",
      churchId: user.churchId,
      user,
      ...tokens,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * List pending join requests for current church (admin only).
 */
exports.getPendingRequests = async (req, res) => {
  try {
    const admin = await User.findById(req.user.userId).lean();
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    const pendingUsers = await User.find({
      churchId: req.user.churchId,
      approvalStatus: "pending",
      isAdmin: false,
    })
      .select("name email role joinedAt")
      .lean();
    res.json(pendingUsers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Approve or reject a pending user request (admin only).
 * Expected body: { decision: "approve" | "reject" }
 */
exports.reviewJoinRequest = async (req, res) => {
  const { userId } = req.params;
  const { decision } = req.body;
  if (!["approve", "reject"].includes(decision)) {
    return res
      .status(400)
      .json({ message: "decision must be either approve or reject" });
  }

  try {
    const admin = await User.findById(req.user.userId).lean();
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const user = await User.findOne({
      _id: userId,
      churchId: req.user.churchId,
      approvalStatus: "pending",
    });

    if (!user) {
      return res.status(404).json({ message: "Pending request not found" });
    }

    if (decision === "reject") {
      user.approvalStatus = "rejected";
      user.approvedAt = null;
      await user.save();
      return res.json({ message: "Request rejected", userId: user._id });
    }

    user.approvalStatus = "approved";
    user.approvedAt = new Date();
    await user.save();

    return res.json({
      message: "Request approved",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        approvalStatus: user.approvalStatus,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * List all members of the requester's church.
 */
exports.getMembers = async (req, res) => {
  try {
    const onlineUserIds = new Set(
      Array.from(activeConnections.values()).map((entry) =>
        entry.userId.toString(),
      ),
    );

    const members = await User.find({
      churchId: req.user.churchId,
      approvalStatus: { $ne: "rejected" },
    })
      .select("name role isAdmin approvalStatus manualAvailable")
      .lean();

    res.json(
      members.map((member) => ({
        ...member,
        available:
          onlineUserIds.has(member._id.toString()) || !!member.manualAvailable,
      })),
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Allow current user to toggle their manual availability flag.
 * Expected body: { available: boolean }
 */
exports.setAvailability = async (req, res) => {
  try {
    const { available } = req.body;
    if (typeof available !== "boolean") {
      return res.status(400).json({ message: "available must be boolean" });
    }
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.manualAvailable = available;
    await user.save();

    res.json({ manualAvailable: user.manualAvailable });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Admin: remove a member from the church roster — drops them from every team
 * and sets approval to rejected (same church only; cannot remove self or
 * another administrator).
 */
exports.removeMemberFromRoster = async (req, res) => {
  try {
    const admin = await User.findById(req.user.userId).lean();
    if (!admin?.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const target = await User.findById(req.params.userId);
    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }
    if (!target.churchId?.equals(req.user.churchId)) {
      return res.status(403).json({ message: "User is not in your church" });
    }
    if (target._id.equals(admin._id)) {
      return res
        .status(400)
        .json({ message: "You cannot remove yourself from the roster" });
    }
    if (target.isAdmin) {
      return res.status(403).json({
        message: "Cannot remove another church administrator from the roster",
      });
    }

    await Team.updateMany(
      { churchId: req.user.churchId },
      { $pull: { members: { userId: target._id } } },
    );

    target.approvalStatus = "rejected";
    target.isAdmin = false;
    target.approvedAt = undefined;
    await target.save();

    res.json({ message: "Member removed from roster" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get current church details for the logged-in user.
 * Church code is returned only to admins.
 */
exports.getCurrentChurch = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).lean();
    if (!user?.churchId) {
      return res
        .status(404)
        .json({ message: "No church found for current user" });
    }

    const church = await Church.findById(user.churchId).lean();
    if (!church) {
      return res.status(404).json({ message: "Church not found" });
    }

    res.json({
      _id: church._id,
      name: church.name,
      churchCode: user.isAdmin ? church.churchCode : null,
      isAdmin: !!user.isAdmin,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
