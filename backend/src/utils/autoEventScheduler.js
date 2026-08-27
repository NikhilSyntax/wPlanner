const AutoEventSchedule = require('../models/AutoEventSchedule');
const Event = require('../models/Event');
const { sendNotification } = require('./notificationService');

// ─── Timezone-aware date helpers (no external dependencies) ────────────────

/**
 * Get current date/time components in a specific IANA timezone.
 * Returns { year, month (1-12), day, hour, minute, dayOfWeek (0=Sun) }
 */
function nowInTimezone(tz) {
  const now = new Date();
  const parts = {};
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', hour12: false,
    weekday: 'short',
  });
  for (const p of fmt.formatToParts(now)) {
    if (p.type === 'year') parts.year = parseInt(p.value);
    if (p.type === 'month') parts.month = parseInt(p.value);
    if (p.type === 'day') parts.day = parseInt(p.value);
    if (p.type === 'hour') parts.hour = parseInt(p.value) % 24;
    if (p.type === 'minute') parts.minute = parseInt(p.value);
    if (p.type === 'weekday') {
      const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      parts.dayOfWeek = map[p.value];
    }
  }
  return parts;
}

/**
 * Convert a local date + time string in a timezone to a UTC Date object.
 * @param {number} year
 * @param {number} month (1-12)
 * @param {number} day
 * @param {string} timeStr "HH:mm"
 * @param {string} tz IANA timezone
 * @returns {Date} UTC Date
 */
function localToUTC(year, month, day, timeStr, tz) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  // Create an approximate UTC date, then adjust using timezone offset
  const rough = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));

  // Calculate the offset by formatting the rough date back into the target tz
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', hour12: false,
  });
  const localParts = {};
  for (const p of fmt.formatToParts(rough)) {
    if (p.type === 'year') localParts.year = parseInt(p.value);
    if (p.type === 'month') localParts.month = parseInt(p.value);
    if (p.type === 'day') localParts.day = parseInt(p.value);
    if (p.type === 'hour') localParts.hour = parseInt(p.value) % 24;
    if (p.type === 'minute') localParts.minute = parseInt(p.value);
  }
  const localDate = new Date(Date.UTC(localParts.year, localParts.month - 1, localParts.day, localParts.hour, localParts.minute));
  const offsetMs = localDate.getTime() - rough.getTime();

  // The actual UTC time = desired local time minus the offset
  return new Date(Date.UTC(year, month - 1, day, hours, minutes) - offsetMs);
}

/**
 * Get the "today" date components in a given timezone (midnight-anchored).
 */
function todayInTimezone(tz) {
  const n = nowInTimezone(tz);
  return { year: n.year, month: n.month, day: n.day, dayOfWeek: n.dayOfWeek };
}

/**
 * Add days to a { year, month, day } object.
 */
function addDays(year, month, day, days) {
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

/**
 * Get the day-of-week for a given date.
 */
function getDayOfWeek(year, month, day) {
  return new Date(year, month - 1, day).getDay();
}

// ─── Occurrence Calculation ────────────────────────────────────────────────

/**
 * Calculate the next N upcoming occurrences for a schedule, starting from today in the schedule's timezone.
 * @param {Object} schedule - AutoEventSchedule document
 * @param {number} count - Number of future occurrences to return (default 2)
 * @returns {Array<{year, month, day}>} Array of occurrence dates
 */
function getNextOccurrences(schedule, count = 2) {
  const tz = schedule.timezone || 'Asia/Kolkata';
  const today = todayInTimezone(tz);
  const occurrences = [];

  if (schedule.frequency === 'weekly') {
    const targetDay = schedule.dayOfWeek; // 0=Sun ... 6=Sat
    // Find next occurrence of targetDay on or after today
    let daysUntil = (targetDay - today.dayOfWeek + 7) % 7;
    // If today is the target day, include today as the first occurrence only if the event hasn't passed
    if (daysUntil === 0) {
      // Include today
    }
    let cursor = addDays(today.year, today.month, today.day, daysUntil);
    for (let i = 0; i < count; i++) {
      occurrences.push({ ...cursor });
      cursor = addDays(cursor.year, cursor.month, cursor.day, 7);
    }
  } else if (schedule.frequency === 'monthly') {
    // Monthly by weekOfMonth + dayOfWeek (e.g., "1st Sunday") or dayOfMonth (e.g., "15th")
    let searchYear = today.year;
    let searchMonth = today.month;

    for (let attempts = 0; attempts < 24 && occurrences.length < count; attempts++) {
      let candidate = null;

      if (schedule.weekOfMonth != null && schedule.dayOfWeek != null) {
        // Nth weekday of month
        candidate = getNthWeekdayOfMonth(searchYear, searchMonth, schedule.dayOfWeek, schedule.weekOfMonth);
      } else if (schedule.dayOfMonth != null) {
        // Fixed day of month
        const daysInMonth = new Date(searchYear, searchMonth, 0).getDate();
        const dom = Math.min(schedule.dayOfMonth, daysInMonth);
        candidate = { year: searchYear, month: searchMonth, day: dom };
      }

      if (candidate) {
        const candidateDate = new Date(candidate.year, candidate.month - 1, candidate.day);
        const todayDate = new Date(today.year, today.month - 1, today.day);
        if (candidateDate >= todayDate) {
          occurrences.push(candidate);
        }
      }

      // Move to next month
      searchMonth++;
      if (searchMonth > 12) {
        searchMonth = 1;
        searchYear++;
      }
    }
  }

  return occurrences;
}

/**
 * Get the Nth occurrence of a weekday in a given month.
 * @param {number} year
 * @param {number} month (1-12)
 * @param {number} dayOfWeek (0=Sun)
 * @param {number} weekNum (1-5; 5 = last)
 * @returns {{year, month, day}|null}
 */
function getNthWeekdayOfMonth(year, month, dayOfWeek, weekNum) {
  const daysInMonth = new Date(year, month, 0).getDate();

  if (weekNum === 5) {
    // Last occurrence: search backward from end of month
    for (let d = daysInMonth; d >= 1; d--) {
      if (getDayOfWeek(year, month, d) === dayOfWeek) {
        return { year, month, day: d };
      }
    }
    return null;
  }

  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    if (getDayOfWeek(year, month, d) === dayOfWeek) {
      count++;
      if (count === weekNum) {
        return { year, month, day: d };
      }
    }
  }
  return null;
}

// ─── Main Scheduler Processing ────────────────────────────────────────────

/**
 * Process all active auto-event schedules across all churches.
 * For each schedule, if an upcoming occurrence falls within the creation window,
 * generate the real Event document (idempotently).
 */
async function processAutoSchedules() {
  try {
    const schedules = await AutoEventSchedule.find({ isActive: true }).lean();

    for (const schedule of schedules) {
      try {
        await processOneSchedule(schedule);
      } catch (err) {
        console.error(`[AutoEventScheduler] Error processing schedule "${schedule.name}" (${schedule._id}):`, err.message);
      }
    }
  } catch (err) {
    console.error('[AutoEventScheduler] Fatal error in processAutoSchedules:', err);
  }
}

/**
 * Process a single schedule: check upcoming occurrences and generate events.
 */
async function processOneSchedule(schedule) {
  const tz = schedule.timezone || 'Asia/Kolkata';
  const today = todayInTimezone(tz);
  const occurrences = getNextOccurrences(schedule, 2);

  for (const occ of occurrences) {
    const occDate = new Date(occ.year, occ.month - 1, occ.day);
    const todayDate = new Date(today.year, today.month - 1, today.day);
    const daysUntil = Math.round((occDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

    // Only generate if within creation window (≤ creationOffsetDays days away) and in the future or today
    if (daysUntil < 0 || daysUntil > schedule.creationOffsetDays) {
      continue;
    }

    // Build the occurrence date as a clean midnight UTC-equivalent for dedup
    const occurrenceDateKey = new Date(Date.UTC(occ.year, occ.month - 1, occ.day));

    // Idempotency check: does an event already exist for this schedule + occurrence?
    const existing = await Event.findOne({
      autoScheduleId: schedule._id,
      occurrenceDate: occurrenceDateKey,
    }).lean();

    if (existing) {
      // Already generated (or was cancelled/deleted by user) — skip
      continue;
    }

    // Build UTC start/end times from local timezone
    const startUTC = localToUTC(occ.year, occ.month, occ.day, schedule.startTime, tz);
    const endUTC = localToUTC(occ.year, occ.month, occ.day, schedule.endTime, tz);

    // Create the real event
    try {
      const newEvent = new Event({
        event: {
          title: schedule.name,
          description: schedule.description || '',
          type: schedule.eventType || 'service',
          status: 'published',
        },
        schedule: {
          start: startUTC,
          end: endUTC,
          timezone: tz,
        },
        createdBy: schedule.createdBy,
        churchId: schedule.churchId,
        autoScheduleId: schedule._id,
        occurrenceDate: occurrenceDateKey,
      });

      await newEvent.save();

      console.log(
        `[AutoEventScheduler] Generated event "${schedule.name}" for ${occ.day}/${occ.month}/${occ.year}` +
        ` (Event ID: ${newEvent._id}, Church: ${schedule.churchId})`
      );

      // Send schedule-configured reminders for this newly created event
      await sendAutoReminders(schedule, newEvent, occ);

    } catch (saveErr) {
      // E11000 duplicate key error = already exists (race condition protection)
      if (saveErr.code === 11000) {
        console.log(`[AutoEventScheduler] Duplicate prevented for "${schedule.name}" on ${occ.day}/${occ.month}/${occ.year}`);
      } else {
        throw saveErr;
      }
    }
  }
}

/**
 * Send configured reminders for auto-generated events.
 * This uses the existing notification infrastructure.
 */
async function sendAutoReminders(schedule, event, occ) {
  if (!Array.isArray(schedule.reminders)) return;

  const tz = schedule.timezone || 'Asia/Kolkata';
  const today = todayInTimezone(tz);
  const todayDate = new Date(today.year, today.month - 1, today.day);
  const occDate = new Date(occ.year, occ.month - 1, occ.day);

  for (const reminder of schedule.reminders) {
    if (!reminder.enabled) continue;

    const reminderDate = new Date(occDate.getTime() - (reminder.offsetDays * 24 * 60 * 60 * 1000));

    // Only send if today is the reminder date (or past it but event hasn't started)
    if (todayDate.getTime() < reminderDate.getTime()) continue;

    // Build a unique reminder key to prevent duplicates
    const reminderField = `autoReminder_${reminder.offsetDays}d_sent`;

    // Check if this reminder was already sent
    const eventDoc = await Event.findById(event._id).lean();
    if (eventDoc && eventDoc[reminderField]) continue;

    // Mark as sent first (before sending) to prevent race conditions
    await Event.updateOne(
      { _id: event._id },
      { $set: { [reminderField]: true } }
    );

    const dateStr = new Date(event.schedule.start).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
    const timeStr = new Date(event.schedule.start).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit',
    });

    const title = reminder.offsetDays === 1
      ? `⏰ Tomorrow: ${schedule.name}`
      : `🔔 ${reminder.offsetDays} days: ${schedule.name}`;
    const message = reminder.offsetDays === 1
      ? `"${schedule.name}" is tomorrow (${dateStr}) at ${timeStr}. Get ready for service!`
      : `"${schedule.name}" is coming up on ${dateStr} at ${timeStr}. Please check your assigned role!`;

    // Send to schedule creator (admin/leader) — individual volunteer reminders
    // are handled by the existing reminderScheduler once volunteers are assigned
    try {
      await sendNotification({
        recipientId: schedule.createdBy,
        type: 'event_reminder',
        title,
        message,
        link: `/events/${event._id}`,
        eventId: event._id,
      });
    } catch (err) {
      console.warn(`[AutoEventScheduler] Reminder notification failed for ${event._id}:`, err.message);
      // Revert the sent flag so next run can retry
      await Event.updateOne(
        { _id: event._id },
        { $set: { [reminderField]: false } }
      );
    }
  }
}

module.exports = {
  processAutoSchedules,
  getNextOccurrences,
  getNthWeekdayOfMonth,
  localToUTC,
  nowInTimezone,
  todayInTimezone,
};
