const mongoose = require("mongoose");
const User = require("../models/User");
const Event = require("../models/Event");
const { getEventDisplayTitle } = require("../utils/eventTitle");

// Return minimal user list for UI dropdowns
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({
      churchId: req.user.churchId,
      approvalStatus: "approved",
    })
      .select("name email role")
      .lean();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Upload profile photo
exports.uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Check file size (5MB max)
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (req.file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ message: "File size exceeds 5MB limit" });
    }

    // Validate file type
    const allowedMimes = ["image/jpeg", "image/png", "image/gif"];
    if (!allowedMimes.includes(req.file.mimetype)) {
      return res
        .status(400)
        .json({ message: "Invalid file type. Only JPG, PNG, and GIF allowed" });
    }

    // Construct the file URL - use the relative path from the uploads directory
    const profilePhotoUrl = `/uploads/${req.file.filename}`;

    console.log("Uploading profile photo for user:", req.user.userId);
    console.log("File saved as:", req.file.filename);
    console.log("Profile photo URL:", profilePhotoUrl);

    // Update user with new profile photo URL
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { profilePhotoUrl },
      { new: true },
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log("User updated successfully with profile photo");

    res.json({
      message: "Profile photo updated successfully",
      profilePhotoUrl: user.profilePhotoUrl,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePhotoUrl: user.profilePhotoUrl,
      },
    });
  } catch (err) {
    console.error("Error uploading profile photo:", err);
    res.status(500).json({ message: "Failed to upload profile photo" });
  }
};

// Update current user's profile settings (instrument / ministry role)
exports.updateProfile = async (req, res) => {
  try {
    const { role } = req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Admins cannot change their primary role through this member settings endpoint
    if (user.isAdmin || req.user.isAdmin) {
      return res.status(403).json({
        message: "Administrators cannot change their primary role through member settings.",
      });
    }

    // Valid non-admin instrument / ministry roles
    const allowedRoles = [
      "Singer",
      "Guitarist",
      "Keyboardist",
      "Drummer",
      "Bassist",
      "Production",
      "Worship Leader",
      "Member",
      "Other",
    ];

    if (!role || !allowedRoles.includes(role)) {
      return res.status(400).json({
        message: `Invalid instrument/role. Must be one of: ${allowedRoles.join(", ")}`,
      });
    }

    user.role = role;
    await user.save();

    res.json({
      message: "Instrument / ministry role updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin,
        isSubAdmin: user.isSubAdmin,
        profilePhotoUrl: user.profilePhotoUrl,
        approvalStatus: user.approvalStatus,
      },
    });
  } catch (err) {
    console.error("Error updating user profile:", err);
    res.status(500).json({ message: "Failed to update profile" });
  }
};

// Get personal ministry activity statistics & serving history
exports.getMinistryStatistics = async (req, res) => {
  try {
    const targetUserId = req.params.userId || req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Authorization check: if querying another user, requester must be admin/sub-admin in the same church
    if (targetUserId.toString() !== req.user.userId.toString()) {
      const isPrivileged = req.user.isAdmin || req.user.isSubAdmin;
      if (!isPrivileged) {
        return res.status(403).json({ message: "Access denied" });
      }

      const targetUser = await User.findById(targetUserId).select("churchId").lean();
      if (!targetUser || !targetUser.churchId.equals(req.user.churchId)) {
        return res.status(403).json({ message: "Cross-church access denied" });
      }
    }

    const userObjectId = new mongoose.Types.ObjectId(targetUserId);
    const churchObjectId = new mongoose.Types.ObjectId(req.user.churchId);
    const now = new Date();

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));

    // Base filter for completed, served events:
    // Event is considered served if it was explicitly marked as 'completed'
    // OR if its scheduled end time has passed (and is not cancelled).
    const servedFilter = {
      churchId: churchObjectId,
      "event.status": { $ne: "cancelled" },
      $or: [
        { "event.status": "completed" },
        { "schedule.end": { $lte: now, $ne: null, $exists: true } },
      ],
      assignments: {
        $elemMatch: {
          userId: userObjectId,
          status: "accepted",
        },
      },
    };

    // Filter for upcoming accepted assignments:
    // Event is upcoming if it has not completed, not cancelled, and ends in the future.
    const upcomingFilter = {
      churchId: churchObjectId,
      "event.status": { $nin: ["cancelled", "completed"] },
      "schedule.end": { $gt: now, $ne: null, $exists: true },
      assignments: {
        $elemMatch: {
          userId: userObjectId,
          status: "accepted",
        },
      },
    };

    // 1. Total distinct completed services served count
    const served = await Event.countDocuments(servedFilter);

    // 2. Total upcoming assignments count
    const upcomingAssignments = await Event.countDocuments(upcomingFilter);

    // 3. Paginated serving history (most recent first)
    const historyDocs = await Event.find(servedFilter)
      .sort({ "schedule.start": -1, "schedule.end": -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("team", "team.name name")
      .lean();

    const servingHistory = historyDocs.map((ev) => {
      const userAssignments = (ev.assignments || []).filter(
        (a) =>
          a.userId &&
          a.userId.toString() === userObjectId.toString() &&
          a.status === "accepted",
      );
      const roles = userAssignments.map((a) => a.role).filter(Boolean);
      const teamName = ev.team?.team?.name || ev.team?.name || null;
      const displayTitle = getEventDisplayTitle(ev);

      return {
        eventId: ev._id,
        eventName: displayTitle,
        title: displayTitle,
        startTime: ev.schedule?.start,
        endTime: ev.schedule?.end,
        timezone: ev.schedule?.timezone || "UTC",
        team: teamName,
        position: roles.join(", ") || "Volunteer",
        roles: roles.length > 0 ? roles : ["Volunteer"],
        notes:
          userAssignments
            .map((a) => a.notes)
            .filter(Boolean)
            .join("; ") || undefined,
      };
    });

    // 4. Breakdown by position / role
    const positionAgg = await Event.aggregate([
      { $match: servedFilter },
      { $unwind: "$assignments" },
      {
        $match: {
          "assignments.userId": userObjectId,
          "assignments.status": "accepted",
        },
      },
      {
        $group: {
          _id: {
            $trim: { input: { $ifNull: ["$assignments.role", "Volunteer"] } },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1, _id: 1 } },
      {
        $project: {
          _id: 0,
          position: "$_id",
          count: 1,
        },
      },
    ]);

    // 5. Breakdown by team
    const teamAgg = await Event.aggregate([
      {
        $match: {
          ...servedFilter,
          team: { $exists: true, $ne: null },
        },
      },
      {
        $lookup: {
          from: "teams",
          localField: "team",
          foreignField: "_id",
          as: "teamDoc",
        },
      },
      { $unwind: { path: "$teamDoc", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            $ifNull: [
              "$teamDoc.team.name",
              { $ifNull: ["$teamDoc.name", "General"] },
            ],
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1, _id: 1 } },
      {
        $project: {
          _id: 0,
          team: "$_id",
          count: 1,
        },
      },
    ]);

    res.json({
      served,
      upcomingAssignments,
      servingHistory,
      positionBreakdown: positionAgg,
      teamBreakdown: teamAgg,
      pagination: {
        total: served,
        page,
        limit,
        hasMore: page * limit < served,
      },
    });
  } catch (err) {
    console.error("[userController] Error fetching ministry statistics:", err);
    res.status(500).json({ message: "Failed to load ministry statistics" });
  }
};
