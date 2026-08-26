const Event = require("../models/Event");
const Team = require("../models/Team");
const Assignment = require("../models/Assignment");
const User = require("../models/User");
const Song = require("../models/Song");
const {
  getEventDisplayTitle,
  ensureEventHasTitle,
  ensureEventPayloadHasTitle,
} = require("../utils/eventTitle");
const { sendNotification } = require("../utils/notificationService");
const { send24HourRemindersForEvent } = require("../utils/reminderScheduler");

const SETLIST_SONG_FIELDS = "title artist key timeSignature";

async function populateEventDetails(eventId) {
  return Event.findById(eventId)
    .populate("team", "team.name members")
    .populate("assignments.userId", "name email role")
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
      .populate("assignments.userId", "name email role")
      .sort({ "schedule.start": 1 });

    const withTitles = events.map((doc) => {
      const obj = doc.toObject();
      obj.title = getEventDisplayTitle(obj);
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
    res.json(obj);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Create event
exports.createEvent = async (req, res) => {
  try {
    const isAdmin = Boolean(
      req.user?.role === "admin" ||
      req.user?.isAdmin ||
      req.user?.isSubAdmin
    );

    const payload = ensureEventPayloadHasTitle(req.body);
    if (!payload.event) payload.event = {};

    // If created by someone other than admin/subadmin, status is always 'draft' (Unconfirmed)
    if (!isAdmin) {
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

    const isAdmin = Boolean(
      req.user?.role === "admin" ||
      req.user?.isAdmin ||
      req.user?.isSubAdmin
    );

    const payload = ensureEventPayloadHasTitle(req.body);

    const newStatus = payload["event.status"] || payload.event?.status;
    const oldStatus = existing.event?.status;

    // Only Admin and Sub-Admin can confirm an event (draft -> published)
    if (newStatus === "published" && oldStatus !== "published" && !isAdmin) {
      return res.status(403).json({ message: "Only administrators and sub-administrators can confirm events" });
    }

    // Only Admin and Sub-Admin can unconfirm an event (published -> draft)
    if (newStatus === "draft" && oldStatus !== "draft" && !isAdmin) {
      return res.status(403).json({ message: "Only administrators and sub-administrators can unconfirm events" });
    }

    // Only Admin and Sub-Admin can mark as completed
    if (newStatus === "completed" && oldStatus !== "completed" && !isAdmin) {
      return res.status(403).json({ message: "Only administrators can mark events as completed" });
    }

    if (oldStatus === "completed" && newStatus && newStatus !== "completed" && !isAdmin) {
      return res.status(403).json({ message: "Only administrators can change status of completed events" });
    }

    if (oldStatus === "completed" && !isAdmin) {
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
        .select("churchId approvalStatus role name")
        .lean();
      if (!u || !u.churchId?.equals(event.churchId)) {
        continue;
      }
      if (u.approvalStatus && u.approvalStatus !== "approved") {
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

// Approve or reject a pending assignment (admin only)
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
    assignment.status = action === "approve" ? "accepted" : "declined";
    assignment.updatedAt = Date.now();
    await assignment.save();
    res.json(assignment);
  } catch (err) {
    console.error(err);
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
