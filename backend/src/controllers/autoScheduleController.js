const AutoEventSchedule = require('../models/AutoEventSchedule');
const Event = require('../models/Event');
const { getNextOccurrences, processAutoSchedules } = require('../utils/autoEventScheduler');

// ─── List all schedules for user's church ──────────────────────────────────

exports.getSchedules = async (req, res) => {
  try {
    const schedules = await AutoEventSchedule.find({ churchId: req.user.churchId })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    // Attach next occurrence to each schedule
    const enriched = schedules.map((s) => {
      const occurrences = getNextOccurrences(s, 1);
      const nextOccurrence = occurrences.length > 0
        ? new Date(occurrences[0].year, occurrences[0].month - 1, occurrences[0].day)
        : null;
      return { ...s, nextOccurrence };
    });

    res.json(enriched);
  } catch (err) {
    console.error('[AutoScheduleController] getSchedules error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Get single schedule ───────────────────────────────────────────────────

exports.getSchedule = async (req, res) => {
  try {
    const schedule = await AutoEventSchedule.findById(req.params.id)
      .populate('createdBy', 'name email')
      .lean();

    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }
    if (String(schedule.churchId) !== String(req.user.churchId)) {
      return res.status(403).json({ message: 'Cross-church access denied' });
    }

    const occurrences = getNextOccurrences(schedule, 3);
    const nextOccurrence = occurrences.length > 0
      ? new Date(occurrences[0].year, occurrences[0].month - 1, occurrences[0].day)
      : null;

    // Count how many events have been generated from this schedule
    const generatedCount = await Event.countDocuments({
      autoScheduleId: schedule._id,
      'event.status': { $ne: 'cancelled' },
    });

    res.json({
      ...schedule,
      nextOccurrence,
      upcomingOccurrences: occurrences.map((o) => new Date(o.year, o.month - 1, o.day)),
      generatedCount,
    });
  } catch (err) {
    console.error('[AutoScheduleController] getSchedule error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Create new schedule ───────────────────────────────────────────────────

exports.createSchedule = async (req, res) => {
  try {
    const {
      name, description, frequency, dayOfWeek, weekOfMonth, dayOfMonth,
      startTime, endTime, timezone, eventType, creationOffsetDays, reminders,
    } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Event name is required' });
    }
    if (!frequency || !['weekly', 'monthly'].includes(frequency)) {
      return res.status(400).json({ message: 'Frequency must be weekly or monthly' });
    }
    if (frequency === 'weekly' && (dayOfWeek == null || dayOfWeek < 0 || dayOfWeek > 6)) {
      return res.status(400).json({ message: 'Valid day of week (0–6) required for weekly schedules' });
    }
    if (!startTime || !/^\d{2}:\d{2}$/.test(startTime)) {
      return res.status(400).json({ message: 'Valid start time (HH:mm) is required' });
    }
    if (!endTime || !/^\d{2}:\d{2}$/.test(endTime)) {
      return res.status(400).json({ message: 'Valid end time (HH:mm) is required' });
    }
    if (startTime >= endTime) {
      return res.status(400).json({ message: 'End time must be after start time' });
    }

    // Build default reminders if not provided
    const defaultReminders = [
      { offsetDays: 3, enabled: true },
      { offsetDays: 1, enabled: true },
    ];

    const schedule = new AutoEventSchedule({
      churchId: req.user.churchId,
      createdBy: req.user.userId,
      name: name.trim(),
      description: description || '',
      frequency,
      dayOfWeek: frequency === 'weekly' ? dayOfWeek : undefined,
      weekOfMonth: frequency === 'monthly' ? weekOfMonth : undefined,
      dayOfMonth: frequency === 'monthly' ? dayOfMonth : undefined,
      startTime,
      endTime,
      timezone: timezone || 'Asia/Kolkata',
      eventType: eventType || 'service',
      creationOffsetDays: creationOffsetDays || 3,
      reminders: reminders || defaultReminders,
    });

    await schedule.save();

    const populated = await AutoEventSchedule.findById(schedule._id)
      .populate('createdBy', 'name email')
      .lean();

    // Attach next occurrence
    const occurrences = getNextOccurrences(populated, 1);
    populated.nextOccurrence = occurrences.length > 0
      ? new Date(occurrences[0].year, occurrences[0].month - 1, occurrences[0].day)
      : null;

    console.log(
      `[AutoScheduleController] Created schedule "${schedule.name}" for church ${req.user.churchId}`
    );

    res.status(201).json(populated);
  } catch (err) {
    // Handle duplicate name within church
    if (err.code === 11000) {
      return res.status(400).json({ message: 'A schedule with this name already exists in your church' });
    }
    console.error('[AutoScheduleController] createSchedule error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Update schedule ───────────────────────────────────────────────────────

exports.updateSchedule = async (req, res) => {
  try {
    const schedule = await AutoEventSchedule.findById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }
    if (String(schedule.churchId) !== String(req.user.churchId)) {
      return res.status(403).json({ message: 'Cross-church access denied' });
    }

    const {
      name, description, frequency, dayOfWeek, weekOfMonth, dayOfMonth,
      startTime, endTime, timezone, eventType, creationOffsetDays, reminders,
    } = req.body;

    // Validate updated fields
    if (name !== undefined && (!name || !name.trim())) {
      return res.status(400).json({ message: 'Event name is required' });
    }
    if (frequency && !['weekly', 'monthly'].includes(frequency)) {
      return res.status(400).json({ message: 'Frequency must be weekly or monthly' });
    }
    if (startTime && endTime && startTime >= endTime) {
      return res.status(400).json({ message: 'End time must be after start time' });
    }

    if (name !== undefined) schedule.name = name.trim();
    if (description !== undefined) schedule.description = description;
    if (frequency) schedule.frequency = frequency;
    if (dayOfWeek !== undefined) schedule.dayOfWeek = dayOfWeek;
    if (weekOfMonth !== undefined) schedule.weekOfMonth = weekOfMonth;
    if (dayOfMonth !== undefined) schedule.dayOfMonth = dayOfMonth;
    if (startTime) schedule.startTime = startTime;
    if (endTime) schedule.endTime = endTime;
    if (timezone) schedule.timezone = timezone;
    if (eventType) schedule.eventType = eventType;
    if (creationOffsetDays !== undefined) schedule.creationOffsetDays = creationOffsetDays;
    if (reminders !== undefined) schedule.reminders = reminders;

    await schedule.save();

    const populated = await AutoEventSchedule.findById(schedule._id)
      .populate('createdBy', 'name email')
      .lean();

    const occurrences = getNextOccurrences(populated, 1);
    populated.nextOccurrence = occurrences.length > 0
      ? new Date(occurrences[0].year, occurrences[0].month - 1, occurrences[0].day)
      : null;

    res.json(populated);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'A schedule with this name already exists in your church' });
    }
    console.error('[AutoScheduleController] updateSchedule error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Toggle active/disabled ────────────────────────────────────────────────

exports.toggleSchedule = async (req, res) => {
  try {
    const schedule = await AutoEventSchedule.findById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }
    if (String(schedule.churchId) !== String(req.user.churchId)) {
      return res.status(403).json({ message: 'Cross-church access denied' });
    }

    schedule.isActive = !schedule.isActive;
    await schedule.save();

    console.log(
      `[AutoScheduleController] Schedule "${schedule.name}" ${schedule.isActive ? 'ENABLED' : 'DISABLED'}`
    );

    const populated = await AutoEventSchedule.findById(schedule._id)
      .populate('createdBy', 'name email')
      .lean();

    const occurrences = getNextOccurrences(populated, 1);
    populated.nextOccurrence = occurrences.length > 0
      ? new Date(occurrences[0].year, occurrences[0].month - 1, occurrences[0].day)
      : null;

    res.json(populated);
  } catch (err) {
    console.error('[AutoScheduleController] toggleSchedule error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Delete schedule ───────────────────────────────────────────────────────

exports.deleteSchedule = async (req, res) => {
  try {
    const schedule = await AutoEventSchedule.findById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }
    if (String(schedule.churchId) !== String(req.user.churchId)) {
      return res.status(403).json({ message: 'Cross-church access denied' });
    }

    await AutoEventSchedule.deleteOne({ _id: schedule._id });

    console.log(
      `[AutoScheduleController] Deleted schedule "${schedule.name}" (${schedule._id})`
    );

    res.json({ message: 'Schedule deleted', id: schedule._id });
  } catch (err) {
    console.error('[AutoScheduleController] deleteSchedule error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Admin: manually run scheduler ─────────────────────────────────────────

exports.runNow = async (req, res) => {
  try {
    console.log(`[AutoScheduleController] Manual scheduler run triggered by user ${req.user.userId}`);
    await processAutoSchedules();
    res.json({ message: 'Scheduler executed successfully' });
  } catch (err) {
    console.error('[AutoScheduleController] runNow error:', err);
    res.status(500).json({ message: 'Scheduler execution failed' });
  }
};
