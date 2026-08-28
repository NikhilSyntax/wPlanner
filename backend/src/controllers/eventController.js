const Event = require("../models/Event");
const Team = require("../models/Team");
const Assignment = require("../models/Assignment");
const User = require("../models/User");
const Song = require("../models/Song");
const Notification = require("../models/Notification");
const {
  getEventDisplayTitle,
  ensureEventHasTitle,
  ensureEventPayloadHasTitle,
} = require("../utils/eventTitle");
const { sendNotification, notifyAssignmentStatusUpdated } = require("../utils/notificationService");
const { send24HourRemindersForEvent } = require("../utils/reminderScheduler");

const SETLIST_SONG_FIELDS = "title artist key timeSignature";

async function populateEventDetails(eventId) {
  return Event.findById(eventId)
    .populate("team", "team.name members")
    .populate("assignments.userId", "name email role isAdmin")
    .populate("setlist", SETLIST_SONG_FIELDS);
}

// List events
exports.getEvents = async (req, res) => {
  try {
    const { teamId, status, startDate, endDate } = req.query;
    const filter = {};
    if (teamId) filter.team = teamId;
    if (status) filter["event.status"] = status;
    if (startDate && endDate) {
      filter["schedule.start"] = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }
    // Scope to user's church
    if (req.user && req.user.churchId) {
      filter.churchId = req.user.churchId;
    }

    const events = await Event.find(filter)
      .populate("team", "team.name members")
      .populate("setlist", SETLIST_SONG_FIELDS)
      .populate("assignments.userId", "name email role isAdmin")
      .sort({ "schedule.start": 1 });

    const withTitles = events.map((doc) => {
      const obj = doc.toObject();
      obj.title = getEventDisplayTitle(obj);
      if (Array.isArray(obj.assignments)) {
        obj.assignments = obj.assignments.filter((a) => {
          const u = a.userId || {};
          const r = String(u.role || '').toLowerCase().trim();
          return !u.isAdmin && r !== 'admin';
        });
      }
      return obj;
    });

    res.json(withTitles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get single event
exports.getEvent = async (req, res) => {
  try {
    const event = await populateEventDetails(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    // Double-check church scoping
    if (
      req.user &&
      req.user.churchId &&
      !event.churchId.equals(req.user.churchId)
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    const obj = event.toObject();
    obj.title = getEventDisplayTitle(obj);
    if (Array.isArray(obj.assignments)) {
      obj.assignments = obj.assignments.filter((a) => {
        const u = a.userId || {};
        const r = String(u.role || '').toLowerCase().trim();
        return !u.isAdmin && r !== 'admin';
      });
    }
    res.json(obj);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Sanitize event payload to prevent casting empty strings to ObjectIds and preserve subdocument titles
function sanitizeEventPayload(body, existingDoc = null) {
  const payload = { ...body };

  if (
    payload.team === "" ||
    payload.team === null ||
    payload.team === "null" ||
    payload.team === "undefined"
  ) {
    delete payload.team;
  }
  if (
    payload.chat === "" ||
    payload.chat === null ||
    payload.chat === "null" ||
    payload.chat === "undefined"
  ) {
    delete payload.chat;
  }
  if (Array.isArray(payload.setlist)) {
    payload.setlist = payload.setlist.filter(Boolean);
  }

  if (existingDoc) {
    if (payload.event && typeof payload.event === "object") {
      const currentTitle =
        payload.event.title?.trim() ||
        existingDoc.event?.title ||
        getEventDisplayTitle(existingDoc) ||
        "Untitled Event";
      payload.event.title = currentTitle;
      if (!payload.event.type && existingDoc.event?.type) {
        payload.event.type = existingDoc.event.type;
      }
      if (!payload.event.status && existingDoc.event?.status) {
        payload.event.status = existingDoc.event.status;
      }
    } else {
      delete payload.event;
    }
  } else {
    // createEvent mode
    if (!payload.event || typeof payload.event !== "object") {
      payload.event = {};
    }
    if (!payload.event.title || !payload.event.title.trim()) {
      payload.event.title = getEventDisplayTitle(payload) || "Untitled Event";
    }
    if (!payload.event.type) {
      payload.event.type = payload.type || "service";
    }
    if (!payload.event.status) {
      payload.event.status = "draft";
    }
  }

  return payload;
}

// Create event
exports.createEvent = async (req, res) => {
  try {
    const isFullAdmin = Boolean(
      req.user?.role === "admin" ||
      req.user?.isAdmin
    );

    const payload = sanitizeEventPayload(req.body, null);

    // If created by someone other than full admin (sub-admin, instrumentalist, etc.), status is always 'draft' (Unconfirmed)
    if (!isFullAdmin) {
      payload.event.status = 'draft';
    } else if (!payload.event.status) {
      payload.event.status = 'published';
    }

    const event = new Event({
      ...payload,
      createdBy: req.user.userId,
      churchId: req.user.churchId,
    });
    await event.save();
    const populated = await populateEventDetails(event._id);

    // 1. If draft event created: notify Admin & Sub-Admin
    if (event.event?.status === 'draft') {
      (async () => {
        try {
          const creator = await User.findById(req.user.userId).select('name').lean();
          const creatorName = creator?.name || 'A team member';
          const eventTitle = getEventDisplayTitle(event);
          const dateFormatted = event.schedule?.start
            ? new Date(event.schedule.start).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })
            : '';

          const admins = await User.find({
            churchId: req.user.churchId,
            _id: { $ne: req.user.userId },
            approvalStatus: { $ne: 'rejected' },
            $or: [
              { isAdmin: true },
              { isSubAdmin: true },
              { role: { $in: ['Admin', 'Sub-Admin', 'admin', 'sub_admin'] } },
            ],
          }).select('_id name email').lean();

          for (const admin of admins) {
            await sendNotification({
              recipientId: admin._id,
              senderId: req.user.userId,
              type: 'event_draft',
              title: 'New Draft Event Created 📝',
              message: `${creatorName} created a new draft event "${eventTitle}"${dateFormatted ? ` for ${dateFormatted}` : ''}. Review and confirm it.`,
              link: `/events/${event._id}`,
            });
          }
        } catch (notifyErr) {
          console.error('[EventController] Error notifying admins of draft event:', notifyErr);
        }
      })();
    } else if (event.event?.status === 'published') {
      // 2. If published directly: broadcast confirmation to all church members
      (async () => {
        try {
          const eventTitle = getEventDisplayTitle(event);
          const dateFormatted = event.schedule?.start
            ? new Date(event.schedule.start).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : '';

          const members = await User.find({
            churchId: req.user.churchId,
            _id: { $ne: req.user.userId },
            approvalStatus: { $ne: 'rejected' },
          }).select('_id name email').lean();

          for (const member of members) {
            await sendNotification({
              recipientId: member._id,
              senderId: req.user.userId,
              type: 'event_confirmed',
              title: 'New Event Scheduled! 🎉',
              message: `"${eventTitle}" has been scheduled${dateFormatted ? ` for ${dateFormatted}` : ''}. Check the setlist and schedule!`,
              link: `/events/${event._id}`,
            });
          }
        } catch (notifyErr) {
          console.error('[EventController] Error broadcasting new event:', notifyErr);
        }
      })();
    }

    res.status(201).json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Update event
exports.updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await Event.findById(id);
    if (!existing) return res.status(404).json({ message: "Event not found" });

    // Double-check church scoping
    if (
      req.user &&
      req.user.churchId &&
      !existing.churchId.equals(req.user.churchId)
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    const isFullAdmin = Boolean(
      req.user?.role === "admin" ||
      req.user?.isAdmin
    );

    const payload = sanitizeEventPayload(req.body, existing);

    const newStatus = payload["event.status"] || payload.event?.status;
    const oldStatus = existing.event?.status;

    // Only full Admin can confirm an event (draft -> published)
    if (newStatus === "published" && oldStatus !== "published" && !isFullAdmin) {
      return res.status(403).json({ message: "Only administrators can confirm events" });
    }

    // Only full Admin can unconfirm an event (published -> draft)
    if (newStatus === "draft" && oldStatus !== "draft" && !isFullAdmin) {
      return res.status(403).json({ message: "Only administrators can unconfirm events" });
    }

    // Only full Admin can mark as completed
    if (newStatus === "completed" && oldStatus !== "completed" && !isFullAdmin) {
      return res.status(403).json({ message: "Only administrators can mark events as completed" });
    }

    if (oldStatus === "completed" && newStatus && newStatus !== "completed" && !isFullAdmin) {
      return res.status(403).json({ message: "Only administrators can change status of completed events" });
    }

    if (oldStatus === "completed" && !isFullAdmin) {
      return res.status(403).json({ message: "This event is completed and locked. Only administrators can make changes." });
    }

    const updated = await Event.findByIdAndUpdate(
      id,
      { ...payload, updatedAt: Date.now() },
      { new: true, runValidators: true },
    )
      .populate("team", "team.name")
      .populate("assignments.userId", "name email role")
      .populate("setlist", SETLIST_SONG_FIELDS);

    if (!updated) return res.status(404).json({ message: "Event not found" });

    // When an event is confirmed (published) by an admin: notify all church members
    if (newStatus === "published" && oldStatus !== "published") {
      (async () => {
        try {
          const eventTitle = getEventDisplayTitle(updated);
          const dateFormatted = updated.schedule?.start
            ? new Date(updated.schedule.start).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : '';

          const members = await User.find({
            churchId: req.user.churchId,
            _id: { $ne: req.user.userId },
            approvalStatus: { $ne: 'rejected' },
          }).select('_id name email').lean();

          for (const member of members) {
            await sendNotification({
              recipientId: member._id,
              senderId: req.user.userId,
              type: 'event_confirmed',
              title: 'Event Confirmed! 🎉',
              message: `"${eventTitle}" has been confirmed${dateFormatted ? ` for ${dateFormatted}` : ''}. Check the setlist and schedule!`,
              link: `/events/${updated._id}`,
            });
          }
        } catch (notifyErr) {
          console.error('[EventController] Error broadcasting event confirmation:', notifyErr);
        }
      })();
    }

    const obj = updated.toObject();
    obj.title = getEventDisplayTitle(obj);
    res.json(obj);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete event
exports.deleteEvent = async (req, res) => {
  try {
    const isFullAdmin = Boolean(
      req.user?.role === "admin" ||
      req.user?.isAdmin
    );
    if (!isFullAdmin) {
      return res.status(403).json({ message: "Only administrators can delete events" });
    }

    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });
    await Assignment.deleteMany({ event: req.params.id });
    res.json({ message: "Event deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Add setlist song
exports.addSetlistSong = async (req, res) => {
  try {
    const { id } = req.params;
    const { songId } = req.body;
    if (!songId) {
      return res.status(400).json({ message: "songId is required" });
    }
    const song = await Song.findById(songId);
    if (!song) {
      return res.status(404).json({ message: "Song not found" });
    }
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }
    if (event.setlist.some((sId) => sId.equals(songId))) {
      return res.status(400).json({ message: "Song already in setlist" });
    }
    event.setlist.push(songId);
    event.updatedAt = Date.now();
    await event.save();
    const populated = await populateEventDetails(event._id);
    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Remove setlist song
exports.removeSetlistSong = async (req, res) => {
  try {
    const { id, songId } = req.params;
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }
    event.setlist = event.setlist.filter((sId) => !sId.equals(songId));
    event.updatedAt = Date.now();
    await event.save();
    const populated = await populateEventDetails(event._id);
    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Reorder setlist
exports.reorderSetlist = async (req, res) => {
  try {
    const { id } = req.params;
    const { setlist } = req.body;
    if (!Array.isArray(setlist)) {
      return res.status(400).json({ message: "setlist must be an array of song IDs" });
    }
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }
    event.setlist = setlist;
    event.updatedAt = Date.now();
    await event.save();
    const populated = await populateEventDetails(event._id);
    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Add assignment to event
exports.addAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role, notes } = req.body;

    const event = await Event.findById(id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    // Validate that the assigned user belongs to the same church
    const userToAssign = await User.findById(userId);
    if (!userToAssign || !userToAssign.churchId.equals(req.user.churchId)) {
      return res.status(400).json({
        message: "Assigned user not found or does not belong to your church",
      });
    }

    const assignRole = String(userToAssign.role || '').toLowerCase().trim();
    if (userToAssign.isAdmin || assignRole === 'admin') {
      return res.status(400).json({
        message: "Admins cannot be added into a team.",
      });
    }

    const assignment = new Assignment({
      event: id,
      user: userId,
      role: role || userToAssign.role,
      notes,
      assignedBy: req.user.userId,
      status: "assigned",
    });
    await assignment.save();

    event.assignments.push({
      userId,
      role: role || userToAssign.role,
      status: "assigned",
      notes,
    });
    await event.save();

    // Send notification to assigned user (if not self)
    if (userId.toString() !== req.user.userId.toString()) {
      sendNotification({
        recipientId: userId,
        type: "assignment",
        title: "New Worship Assignment 🎵",
        message: `You were assigned as ${role || userToAssign.role} for "${event.event?.title || 'Worship Service'}".`,
        link: `/events/${event._id}`,
        eventId: event._id,
        actionStatus: "pending",
        assignmentRole: role || userToAssign.role,
      }).catch((err) => console.warn(err.message));
    }

    const populated = await populateEventDetails(event._id);
    res.status(201).json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Replace event roster
exports.setEventTeamFromRoster = async (req, res) => {
  try {
    const event = await Event.findOne({
      _id: req.params.id,
      churchId: req.user.churchId,
    });
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const { members } = req.body;
    if (!Array.isArray(members)) {
      return res.status(400).json({ message: "members must be an array" });
    }

    await Assignment.deleteMany({ event: event._id });
    event.assignments = [];

    const seen = new Set();
    for (const row of members) {
      const userId = row.userId || row._id;
      if (!userId || seen.has(userId.toString())) continue;
      seen.add(userId.toString());

      const u = await User.findById(userId)
        .select("churchId approvalStatus role name isAdmin")
        .lean();
      if (!u || !u.churchId?.equals(event.churchId)) {
        continue;
      }
      if (u.approvalStatus && u.approvalStatus !== "approved") {
        continue;
      }
      const uRole = String(u.role || '').toLowerCase().trim();
      if (u.isAdmin || uRole === 'admin') {
        continue;
      }

      const role = (row.role && String(row.role).trim()) || u.role || "Member";

      const assignment = new Assignment({
        event: event._id,
        user: userId,
        role,
        assignedBy: req.user.userId,
        status: "assigned",
      });
      await assignment.save();

      event.assignments.push({
        userId,
        role,
        status: "assigned",
        notes: row.notes || undefined,
      });
    }

    event.updatedAt = new Date();
    await event.save();

    // Notify assigned members asynchronously
    const eventTitle = event.event?.title || "Worship Service";
    for (const assignment of event.assignments) {
      if (assignment.userId && !assignment.userId.equals(req.user.userId)) {
        sendNotification({
          recipientId: assignment.userId,
          type: "assignment",
          title: "New Worship Assignment 🎵",
          message: `You were scheduled as ${assignment.role} for "${eventTitle}".`,
          link: `/events/${event._id}`,
          eventId: event._id,
          actionStatus: "pending",
          assignmentRole: assignment.role,
        }).catch((err) => console.warn("Failed to notify user:", err.message));
      }
    }

    const populated = await Event.findById(event._id)
      .populate("assignments.userId", "name email role")
      .populate("team", "team.name")
      .lean();

    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get assignments for event
exports.getAssignments = async (req, res) => {
  try {
    const assignments = await Assignment.find({ event: req.params.id })
      .populate("user", "profile.name")
      .populate("assignedBy", "profile.name");
    res.json(assignments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete an assignment
exports.deleteAssignment = async (req, res) => {
  try {
    const { id, assignmentId } = req.params;
    const assignment = await Assignment.findByIdAndDelete(assignmentId);
    if (!assignment)
      return res.status(404).json({ message: "Assignment not found" });

    await Event.findByIdAndUpdate(id, {
      $pull: { assignments: { userId: assignment.user } },
    });
    res.json({ message: "Assignment removed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Approve or reject a pending assignment
exports.approveAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { action } = req.body; // 'approve' or 'reject'
    if (!["approve", "reject"].includes(action)) {
      return res
        .status(400)
        .json({ message: 'Invalid action. Use "approve" or "reject".' });
    }
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment)
      return res.status(404).json({ message: "Assignment not found" });
    const event = await Event.findById(assignment.event);
    if (!event || !event.churchId.equals(req.user.churchId)) {
      return res.status(403).json({ message: "Cross-church access denied" });
    }
    const newStatus = action === "approve" ? "accepted" : "declined";
    assignment.status = newStatus;
    assignment.updatedAt = Date.now();
    await assignment.save();

    // Update in event.assignments
    const memberIndex = event.assignments.findIndex(
      (a) => a.userId && a.userId.toString() === assignment.user.toString()
    );
    if (memberIndex !== -1) {
      event.assignments[memberIndex].status = newStatus;
      event.updatedAt = new Date();
      await event.save();
    }

    res.json(assignment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Respond to assignment (accept/decline by volunteer for a specific event)
exports.respondToAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, action } = req.body;
    let normalizedStatus = status;
    if (!normalizedStatus && action) {
      normalizedStatus =
        action === "approve" || action === "accept" || action === "accepted"
          ? "accepted"
          : "declined";
    }
    if (!["accepted", "declined", "assigned", "pending"].includes(normalizedStatus)) {
      return res.status(400).json({ message: 'Invalid status. Use "accepted" or "declined".' });
    }

    if (req.user?.role === 'admin' || req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admins cannot accept or decline team assignments.' });
    }

    const event = await Event.findOne({
      _id: id,
      churchId: req.user.churchId,
    });
    if (!event) return res.status(404).json({ message: "Event not found" });

    // Enforce that users can only change their own assignment status
    const userId = req.user.userId;
    if (req.body.userId && req.body.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        message: "You cannot change another member's response.",
      });
    }

    let assignmentIndex = event.assignments.findIndex((a) => {
      const uid = a.userId?._id ? a.userId._id.toString() : a.userId?.toString();
      return uid === userId.toString();
    });

    let assignedRole = "Team Member";
    if (assignmentIndex !== -1) {
      event.assignments[assignmentIndex].status = normalizedStatus;
      assignedRole = event.assignments[assignmentIndex].role || assignedRole;
    } else {
      const userDoc = await User.findById(userId).select("role name").lean();
      assignedRole = userDoc?.role || "Team Member";
      event.assignments.push({
        userId,
        role: assignedRole,
        status: normalizedStatus,
      });
    }

    event.updatedAt = new Date();
    await event.save();

    // Sync Assignment collection
    await Assignment.findOneAndUpdate(
      { event: event._id, user: userId },
      {
        status: normalizedStatus,
        updatedAt: Date.now(),
        $setOnInsert: {
          assignedBy: req.user.userId,
          role: assignedRole,
        },
      },
      { upsert: true, new: true }
    );

    // Sync any related notifications for this user and event
    await Notification.updateMany(
      {
        recipient: userId,
        $or: [{ eventId: event._id }, { link: new RegExp(event._id.toString()) }],
      },
      { $set: { actionStatus: normalizedStatus, read: true } }
    );

    notifyAssignmentStatusUpdated(userId, event._id, normalizedStatus);

    const populated = await populateEventDetails(event._id);
    res.json({
      success: true,
      status: normalizedStatus,
      event: populated,
    });
  } catch (err) {
    console.error("[EventController] Error responding to assignment:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Trigger manual advance reminder for an event
exports.triggerEventReminder = async (req, res) => {
  try {
    const event = await Event.findOne({
      _id: req.params.id,
      churchId: req.user.churchId,
    });
    if (!event) return res.status(404).json({ message: "Event not found" });

    await send24HourRemindersForEvent(event, req.user.userId);
    res.json({ success: true, message: "Reminder sent to assigned members and team." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to dispatch reminder" });
  }
};

// Volunteer self-opt-in for an event ("Available to serve")
exports.optInToEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, notes } = req.body;
    const userId = req.user.userId;

    const event = await Event.findOne({
      _id: id,
      churchId: req.user.churchId,
    });
    if (!event) return res.status(404).json({ message: "Event not found" });

    if (event.event?.status === 'cancelled') {
      return res.status(400).json({ message: "Cannot volunteer for a cancelled event." });
    }
    if (event.event?.status === 'completed') {
      return res.status(400).json({ message: "This event is already completed." });
    }

    const userDoc = await User.findById(userId).select("role name email isAdmin").lean();
    const userRole = String(userDoc?.role || req.user?.role || '').toLowerCase().trim();
    if (userDoc?.isAdmin || req.user?.isAdmin || userRole === 'admin') {
      return res.status(403).json({ message: "Admins cannot volunteer to serve." });
    }
    const assignedRole = (role && String(role).trim()) || userDoc?.role || "Volunteer";

    // Check if user is already assigned or opted in
    let existingIndex = event.assignments.findIndex((a) => {
      const aUid = a.userId?._id ? a.userId._id.toString() : a.userId?.toString();
      return aUid === userId.toString();
    });

    if (existingIndex !== -1) {
      const existingStatus = event.assignments[existingIndex].status;
      if (existingStatus === 'accepted') {
        return res.status(400).json({ message: "You are already confirmed in the roster for this event." });
      }
      // If pending, assigned, or opt_in_pending, update preference
      event.assignments[existingIndex].role = assignedRole;
      event.assignments[existingIndex].status = 'opt_in_pending';
      if (notes) event.assignments[existingIndex].notes = notes;
    } else {
      event.assignments.push({
        userId,
        role: assignedRole,
        status: 'opt_in_pending',
        notes: notes || undefined,
      });
    }

    event.updatedAt = new Date();
    await event.save();

    // Sync Assignment collection
    await Assignment.findOneAndUpdate(
      { event: event._id, user: userId },
      {
        status: 'opt_in_pending',
        role: assignedRole,
        notes: notes || undefined,
        updatedAt: Date.now(),
        $setOnInsert: { assignedBy: userId },
      },
      { upsert: true, new: true }
    );

    // Sync any related notifications for this user and event to 'contributed'
    await Notification.updateMany(
      {
        recipient: userId,
        $or: [{ eventId: event._id }, { link: new RegExp(event._id.toString()) }],
      },
      { $set: { actionStatus: 'contributed', read: true } }
    );

    notifyAssignmentStatusUpdated(userId, event._id, 'contributed');

    // Notify event creator / church admins asynchronously
    (async () => {
      try {
        const admins = await User.find({
          churchId: req.user.churchId,
          _id: { $ne: userId },
          $or: [{ isAdmin: true }, { isSubAdmin: true }, { role: { $in: ['Admin', 'Sub-Admin', 'Worship Leader'] } }],
        }).select('_id').lean();

        const eventTitle = getEventDisplayTitle(event);
        for (const admin of admins) {
          sendNotification({
            recipientId: admin._id,
            senderId: userId,
            type: 'volunteer_opt_in',
            title: 'Volunteer Available to Serve 🙋',
            message: `${userDoc?.name || 'A volunteer'} offered to serve as ${assignedRole} for "${eventTitle}".`,
            link: `/events/${event._id}`,
            eventId: event._id,
          }).catch((err) => console.warn('[optIn] Notification error:', err.message));
        }
      } catch (notifyErr) {
        console.error('[optIn] Admin notification error:', notifyErr);
      }
    })();

    const populated = await populateEventDetails(event._id);
    res.json({
      success: true,
      message: "You have offered to serve! The leader has been notified.",
      event: populated,
    });
  } catch (err) {
    console.error("[EventController] Error in optInToEvent:", err);
    res.status(500).json({ message: "Failed to opt in" });
  }
};

// Volunteer withdraws their self-opt-in request
exports.withdrawOptIn = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const event = await Event.findOne({
      _id: id,
      churchId: req.user.churchId,
    });
    if (!event) return res.status(404).json({ message: "Event not found" });

    // Remove from event.assignments if status is 'opt_in_pending'
    event.assignments = event.assignments.filter((a) => {
      const aUid = a.userId?._id ? a.userId._id.toString() : a.userId?.toString();
      if (aUid === userId.toString()) {
        return a.status !== 'opt_in_pending';
      }
      return true;
    });

    event.updatedAt = new Date();
    await event.save();

    await Assignment.deleteMany({ event: event._id, user: userId, status: 'opt_in_pending' });

    const populated = await populateEventDetails(event._id);
    res.json({
      success: true,
      message: "Opt-in withdrawn.",
      event: populated,
    });
  } catch (err) {
    console.error("[EventController] Error in withdrawOptIn:", err);
    res.status(500).json({ message: "Failed to withdraw opt-in" });
  }
};

// Leader / Admin confirms or declines an opted-in volunteer into active team roster
exports.reviewOptInVolunteer = async (req, res) => {
  try {
    const { id, userId: targetUserId } = req.params;
    const { action, role } = req.body; // action: 'confirm' (or 'accept') vs 'decline' (or 'dismiss')

    const isPrivileged = req.user.isAdmin || req.user.isSubAdmin || ['worship leader', 'team_leader', 'pastor', 'admin'].includes(String(req.user.role).toLowerCase());
    if (!isPrivileged) {
      return res.status(403).json({ message: "Only team leaders and administrators can review volunteers." });
    }

    const event = await Event.findOne({
      _id: id,
      churchId: req.user.churchId,
    });
    if (!event) return res.status(404).json({ message: "Event not found" });

    const memberIndex = event.assignments.findIndex((a) => {
      const aUid = a.userId?._id ? a.userId._id.toString() : a.userId?.toString();
      return aUid === targetUserId.toString();
    });

    if (memberIndex === -1) {
      return res.status(404).json({ message: "Volunteer not found in event sign-ups." });
    }

    const isConfirm = action === 'confirm' || action === 'accept' || action === 'accepted';

    if (isConfirm) {
      const assignedRole = role || event.assignments[memberIndex].role || "Volunteer";
      event.assignments[memberIndex].status = 'accepted';
      event.assignments[memberIndex].role = assignedRole;

      await Assignment.findOneAndUpdate(
        { event: event._id, user: targetUserId },
        {
          status: 'accepted',
          role: assignedRole,
          assignedBy: req.user.userId,
          updatedAt: Date.now(),
        },
        { upsert: true, new: true }
      );

      // Notify the volunteer
      const eventTitle = getEventDisplayTitle(event);
      sendNotification({
        recipientId: targetUserId,
        senderId: req.user.userId,
        type: 'assignment',
        title: 'Volunteer Request Confirmed! 🎉',
        message: `You have been confirmed as ${assignedRole} for "${eventTitle}".`,
        link: `/events/${event._id}`,
        eventId: event._id,
        actionStatus: 'accepted',
        assignmentRole: assignedRole,
      }).catch((err) => console.warn('[reviewOptIn] Notification error:', err.message));
    } else {
      // Declined / dismissed -> remove from assignments or mark declined
      event.assignments.splice(memberIndex, 1);
      await Assignment.deleteMany({ event: event._id, user: targetUserId });
    }

    event.updatedAt = new Date();
    await event.save();

    const populated = await populateEventDetails(event._id);
    res.json({
      success: true,
      message: isConfirm ? "Volunteer confirmed into roster!" : "Volunteer sign-up dismissed.",
      event: populated,
    });
  } catch (err) {
    console.error("[EventController] Error in reviewOptInVolunteer:", err);
    res.status(500).json({ message: "Failed to review volunteer" });
  }
};
