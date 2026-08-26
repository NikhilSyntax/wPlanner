const Event = require('../models/Event');
const Team = require('../models/Team');
const User = require('../models/User');
const { sendNotification } = require('./notificationService');
const { getEventDisplayTitle } = require('./eventTitle');

/**
 * Dispatch advance reminder notifications for a single event to assigned members and team.
 *
 * @param {Object} event - Event document
 * @param {Object} options
 * @param {string} [options.timeframe='manual'] - '24h' | '12h' | '2h' | 'manual'
 * @param {string} [options.excludeUserId=null] - User ID of sender (excluded from receiving)
 */
async function sendEventReminder(event, { timeframe = 'manual', excludeUserId = null } = {}) {
  try {
    if (!event || !event.schedule?.start) return;

    const eventTitle = getEventDisplayTitle(event) || 'Worship Service';
    const startDate = new Date(event.schedule.start);
    const timeString = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateString = startDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

    const recipientSet = new Set();

    // 1. Add all assigned volunteers & instrumentalists
    if (Array.isArray(event.assignments)) {
      for (const a of event.assignments) {
        const uid = a.userId?._id ? a.userId._id.toString() : a.userId?.toString();
        if (uid) recipientSet.add(uid);
      }
    }

    // 2. Add team members if event has an assigned team
    if (event.team) {
      const teamId = event.team?._id || event.team;
      const teamDoc = await Team.findById(teamId).select('members').lean();
      if (teamDoc && Array.isArray(teamDoc.members)) {
        for (const m of teamDoc.members) {
          const uid = m.userId?.toString();
          if (uid) recipientSet.add(uid);
        }
      }
    }

    // Exclude sender / initiator so they don't receive notifications for their own action
    if (excludeUserId) {
      recipientSet.delete(excludeUserId.toString());
    }

    const recipientIds = Array.from(recipientSet);
    console.log(
      `[ReminderScheduler] Dispatching ${timeframe} reminder for "${eventTitle}" to ${recipientIds.length} recipient(s)`
    );

    let title = `🔔 Worship Reminder: ${eventTitle}`;
    let message = `Reminder for "${eventTitle}" on ${dateString} at ${timeString}. Please check your assigned role and songs!`;

    if (timeframe === '24h') {
      title = `⏰ 24h Alert: ${eventTitle}`;
      message = `"${eventTitle}" is scheduled for tomorrow (${dateString}) at ${timeString}. Please review your role and setlist!`;
    } else if (timeframe === '12h') {
      title = `⏰ 12h Alert: ${eventTitle}`;
      message = `"${eventTitle}" is coming up in 12 hours (${dateString} at ${timeString}). Get ready for service!`;
    } else if (timeframe === '2h') {
      title = `🚨 2h Final Reminder: ${eventTitle}`;
      message = `"${eventTitle}" starts in 2 hours at ${timeString}! Check in with your team.`;
    }

    // Send notifications concurrently across channels (In-App + Socket + Chrome Banner Web Push)
    await Promise.all(
      recipientIds.map((userId) =>
        sendNotification({
          recipientId: userId,
          senderId: excludeUserId,
          type: 'event_reminder',
          title,
          message,
          link: `/events/${event._id}`,
        }).catch((err) => console.warn(`[ReminderScheduler] Failed to send to ${userId}:`, err.message))
      )
    );

    // Mark event flag as sent if automated
    if (timeframe === '24h') {
      await Event.updateOne({ _id: event._id }, { $set: { reminder24hSent: true } });
    } else if (timeframe === '12h') {
      await Event.updateOne({ _id: event._id }, { $set: { reminder12hSent: true } });
    } else if (timeframe === '2h') {
      await Event.updateOne({ _id: event._id }, { $set: { reminder2hSent: true } });
    }
  } catch (err) {
    console.error(`[ReminderScheduler] Error processing event ${event?._id}:`, err);
  }
}

// Backward-compatible alias for existing imports
async function send24HourRemindersForEvent(event, excludeUserId = null) {
  return sendEventReminder(event, { timeframe: 'manual', excludeUserId });
}

/**
 * Check MongoDB for upcoming events within 24h, 12h, and 2h windows and dispatch reminders
 */
async function checkAndSendAutomatedReminders() {
  try {
    const now = new Date();
    const nowMs = now.getTime();

    // Look for published or active events occurring within the next 25 hours
    const maxLookahead = new Date(nowMs + 25 * 60 * 60 * 1000);

    const upcomingEvents = await Event.find({
      'schedule.start': { $gte: now, $lte: maxLookahead },
      'event.status': { $in: ['published', 'in_progress'] },
    });

    for (const event of upcomingEvents) {
      const eventStartMs = new Date(event.schedule.start).getTime();
      const diffHours = (eventStartMs - nowMs) / (1000 * 60 * 60);

      // 1. 24-Hour Reminder (when within <= 24.0 hours and not yet sent)
      if (diffHours <= 24 && !event.reminder24hSent) {
        console.log(`[ReminderScheduler] Triggering 24h reminder for event: ${event._id}`);
        await sendEventReminder(event, { timeframe: '24h' });
      }

      // 2. 12-Hour Reminder (when within <= 12.0 hours and not yet sent)
      if (diffHours <= 12 && !event.reminder12hSent) {
        console.log(`[ReminderScheduler] Triggering 12h reminder for event: ${event._id}`);
        await sendEventReminder(event, { timeframe: '12h' });
      }

      // 3. 2-Hour Final Reminder (when within <= 2.0 hours and not yet sent)
      if (diffHours <= 2 && !event.reminder2hSent) {
        console.log(`[ReminderScheduler] Triggering 2h reminder for event: ${event._id}`);
        await sendEventReminder(event, { timeframe: '2h' });
      }
    }
  } catch (err) {
    console.error('[ReminderScheduler] Error during automated scheduled check:', err);
  }
}

let schedulerTimer = null;

/**
 * Start recurring background scheduler (checks every 60 seconds)
 */
function startReminderScheduler(intervalMs = 60 * 1000) {
  if (schedulerTimer) return;

  // Run initial check after 5s delay to allow DB connection to stabilize
  setTimeout(() => {
    checkAndSendAutomatedReminders();
  }, 5000);

  // Periodic recurring check every 1 minute
  schedulerTimer = setInterval(checkAndSendAutomatedReminders, intervalMs);
  console.log(`[ReminderScheduler] Automated reminder scheduler started (checking 24h, 12h, 2h intervals every ${intervalMs / 1000}s)`);
}

module.exports = {
  sendEventReminder,
  send24HourRemindersForEvent,
  checkAndSendAutomatedReminders,
  startReminderScheduler,
};
