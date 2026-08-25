const Event = require("../models/Event");
const Team = require("../models/Team");
const Assignment = require("../models/Assignment");
const User = require("../models/User");
const Song = require("../models/Song");
const {
  getEventDisplayTitle,
  ensureEventHasTitle,
} = require("../utils/eventTitle");

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
    const events = await Event.find({ ...filter, churchId: req.user.churchId })
      .populate("team", "team.name")
      .sort({ "schedule.start": 1 });
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get single event
exports.getEvent = async (req, res) => {
  try {
    const event = await Event.findOne({
      _id: req.params.id,
      churchId: req.user.churchId,
    });
    if (!event) return res.status(404).json({ message: "Event not found" });

    const populated = await populateEventDetails(event._id);
    if (!populated) return res.status(404).json({ message: "Event not found" });

    const title = await ensureEventHasTitle(populated);
    if (populated.event?.status === "completed") {
      await syncCompletedEventSongUsage(populated, null, title);
    } else if (title) {
      await syncEventNameInSongUsage(populated._id, title);
    }

    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Create event
exports.createEvent = async (req, res) => {
  try {
    // Support both legacy flat payload and current nested payload.
    const rawTitle = req.body?.event?.title ?? req.body?.title;
    const description = req.body?.event?.description ?? req.body?.description;
    const type = req.body?.event?.type ?? req.body?.type ?? "service";
    const start = req.body?.schedule?.start ?? req.body?.start;
    const end = req.body?.schedule?.end ?? req.body?.end;
    const timezone = req.body?.schedule?.timezone ?? req.body?.timezone;
    const teamId = req.body?.team ?? req.body?.teamId;
    // Setlists removed: ignore any setlist fields from older clients
    const title = typeof rawTitle === "string" ? rawTitle.trim() : rawTitle;

    const missingFields = [];
    if (!title) missingFields.push("title");
    if (!start) missingFields.push("start");
    if (!end) missingFields.push("end");

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: `Missing required field(s): ${missingFields.join(", ")}`,
      });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return res.status(400).json({ message: "Invalid start or end datetime" });
    }
    if (startDate >= endDate) {
      return res
        .status(400)
        .json({ message: "End time must be after start time" });
    }

    const event = new Event({
      event: { title, description, type: type || "service" },
      schedule: { start: startDate, end: endDate, timezone },
      team: teamId || undefined,
      createdBy: req.user.userId,
      churchId: req.user.churchId,
    });
    await event.save();
    res.status(201).json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

function normalizeSetlistIds(setlist) {
  if (!Array.isArray(setlist)) return [];
  return setlist
    .map((item) => {
      if (!item) return null;
      if (typeof item === "string") return item;
      return item._id || item;
    })
    .filter(Boolean);
}

/** Record last-used / times-used for each song when an event is completed (idempotent per event). */
async function recordSetlistUsageOnCompletion(
  eventId,
  eventTitle,
  songIds,
  usedAt = new Date(),
) {
  const uniqueIds = [...new Set(normalizeSetlistIds(songIds).map((id) => String(id)))];
  if (!uniqueIds.length) return;

  const performedAt = usedAt instanceof Date ? usedAt : new Date(usedAt);

  for (const songId of uniqueIds) {
    const song = await Song.findById(songId).select("usage.usageHistory").lean();
    if (!song) continue;

    const alreadyRecorded = (song.usage?.usageHistory || []).some(
      (entry) => String(entry.eventId) === String(eventId),
    );
    if (alreadyRecorded) {
      if (eventTitle?.trim()) {
        await syncEventNameInSongUsage(eventId, eventTitle, [songId]);
      }
      continue;
    }

    await Song.findByIdAndUpdate(songId, {
      $set: { "usage.lastPerformed": performedAt },
      $inc: { "usage.timesPerformed": 1 },
      $push: {
        "usage.usageHistory": {
          eventId,
          eventTitle: eventTitle?.trim() || "Unknown Event",
          usedAt: performedAt,
        },
      },
    });
  }
}

/** Keep usage history event names in sync when the event is renamed or backfilled. */
async function syncEventNameInSongUsage(eventId, eventTitle, songIds = null) {
  const title = typeof eventTitle === "string" ? eventTitle.trim() : "";
  if (!eventId || !title) return;

  const eventIdStr = String(eventId);
  const query = { "usage.usageHistory.0": { $exists: true } };
  const ids = songIds ? normalizeSetlistIds(songIds) : [];
  if (ids.length) query._id = { $in: ids };

  const songs = await Song.find(query).select("usage.usageHistory");
  for (const song of songs) {
    let modified = false;
    for (const entry of song.usage?.usageHistory || []) {
      if (String(entry.eventId) === eventIdStr && entry.eventTitle !== title) {
        entry.eventTitle = title;
        modified = true;
      }
    }
    if (modified) {
      song.markModified("usage.usageHistory");
      await song.save();
    }
  }
}

function resolveEventTitle(eventDoc, titleFallback, updates) {
  const fromUpdate =
    updates && updates["event.title"] !== undefined
      ? updates["event.title"]
      : undefined;
  const merged = {
    event: {
      ...(eventDoc?.event?.toObject?.() || eventDoc?.event || {}),
      ...(fromUpdate !== undefined ? { title: fromUpdate } : {}),
    },
    schedule: eventDoc?.schedule,
  };
  const resolved = getEventDisplayTitle(merged);
  return resolved || (titleFallback || "").trim();
}

async function syncCompletedEventSongUsage(
  eventDoc,
  setlistOverride,
  titleFallback,
) {
  if (!eventDoc || eventDoc.event?.status !== "completed") return;

  const setlistIds = setlistOverride ?? eventDoc.setlist;
  const ids = normalizeSetlistIds(setlistIds);
  if (!ids.length) return;

  const eventTitle = resolveEventTitle(eventDoc, titleFallback, null);
  const performedAt = eventDoc.schedule?.end || new Date();

  await recordSetlistUsageOnCompletion(
    eventDoc._id,
    eventTitle,
    ids,
    performedAt,
  );

  if (eventTitle) {
    await syncEventNameInSongUsage(eventDoc._id, eventTitle, ids);
  }
}

// Update event
exports.updateEvent = async (req, res) => {
  try {
    const updates = { ...req.body };

    if (updates.team === "") {
      updates.team = null;
    }
    if (Array.isArray(updates.setlist)) {
      const seen = new Set();
      updates.setlist = updates.setlist
        .map((id) => String(id))
        .filter((id) => id && !seen.has(id) && seen.add(id));
    }

    // Partial event fields (e.g. status) must use dot paths so we don't replace the whole event object
    if (updates.event && typeof updates.event === "object" && !Array.isArray(updates.event)) {
      const nestedEvent = updates.event;
      delete updates.event;
      for (const [key, value] of Object.entries(nestedEvent)) {
        updates[`event.${key}`] = value;
      }
    }

    const eventBeforeUpdate = await Event.findById(req.params.id);
    if (!eventBeforeUpdate) {
      return res.status(404).json({ message: "Event not found" });
    }

    const updatedEvent = await Event.findByIdAndUpdate(
      req.params.id,
      { $set: { ...updates, updatedAt: Date.now() } },
      { new: true },
    );
    if (!updatedEvent)
      return res.status(404).json({ message: "Event not found" });

    await ensureEventHasTitle(updatedEvent);

    const resolvedTitle = resolveEventTitle(
      updatedEvent,
      getEventDisplayTitle(eventBeforeUpdate),
      updates,
    );

    if (resolvedTitle) {
      await syncEventNameInSongUsage(updatedEvent._id, resolvedTitle);
    }

    if (updatedEvent.event?.status === "completed") {
      const setlistForUsage = Array.isArray(updates.setlist)
        ? updates.setlist
        : updatedEvent.setlist;
      await syncCompletedEventSongUsage(
        updatedEvent,
        setlistForUsage,
        resolvedTitle,
      );
    }

    const populated = await populateEventDetails(updatedEvent._id);
    res.json(populated || updatedEvent);
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

// Add assignment to event
exports.addAssignment = async (req, res) => {
  try {
    const { userId, role, notes } = req.body;
    const assignment = new Assignment({
      event: req.params.id,
      user: userId,
      role,
      notes,
      assignedBy: req.user.userId,
      status: role.toLowerCase() === "member" ? "accepted" : "pending",
    });
    await assignment.save();
    await Event.findByIdAndUpdate(req.params.id, {
      $push: { assignments: { userId, role, notes } },
    });
    res.status(201).json(assignment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Replace event roster: remove all assignments, then add members from church
 * roster (must be approved users in the same church). team_leader or admin.
 */
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

// Delete assignment
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
    // Ensure assignment belongs to same church via event
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

// Setlists removed
