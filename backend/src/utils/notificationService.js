const Notification = require('../models/Notification');
const { getIO } = require('../sockets/socketServer');
const { sendPushToUser } = require('./pushService');

/**
 * Dispatch a notification across all channels:
 * 1. Database in-app notification record
 * 2. Socket.io instant in-app update
 * 3. Mobile phone / browser lock-screen Web Push
 *
 * @param {Object} params
 * @param {string} params.recipientId - User ID of recipient
 * @param {string} [params.senderId] - User ID of sender (strictly excluded from receiving)
 * @param {string} params.type - 'assignment' | 'event_reminder' | 'setlist_update' | 'chat_mention' | 'system'
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification body text
 * @param {string} [params.link] - Target route link (e.g. /events/123)
 */
exports.sendNotification = async ({
  recipientId,
  senderId,
  type,
  title,
  message,
  link,
  eventId,
  actionStatus,
  assignmentRole,
}) => {
  try {
    if (!recipientId || !title || !message) return null;

    const recipientIdStr = String(recipientId);
    const senderIdStr = senderId ? String(senderId) : '';

    // Absolute self-exclusion guard: never create or dispatch notification to the sender
    if (senderIdStr && recipientIdStr === senderIdStr) {
      console.log(`[NotificationService] Suppressed notification for self (sender: ${senderIdStr})`);
      return null;
    }

    // 1. Create In-App Notification Record
    const notification = new Notification({
      recipient: recipientId,
      type: type || 'system',
      title,
      message,
      link: link || '',
      eventId: eventId || null,
      actionStatus:
        actionStatus !== undefined
          ? actionStatus
          : type === 'assignment'
          ? 'pending'
          : null,
      assignmentRole: assignmentRole || '',
      read: false,
      sentVia: ['in_app', 'push'],
    });
    await notification.save();

    // 2. Emit Socket.IO Event for live open tabs
    try {
      const io = getIO();
      if (io) {
        io.to(`user_${recipientId}`).emit('notification:new', notification);
      }
    } catch (socketErr) {
      console.warn('[NotificationService] Socket emission warning:', socketErr.message);
    }

    // 3. Dispatch Phone / Browser Web Push Notification
    try {
      await sendPushToUser(recipientId, {
        title,
        message,
        link,
        type,
        senderId: senderIdStr || null,
      });
    } catch (pushErr) {
      console.warn('[NotificationService] Web push dispatch warning:', pushErr.message);
    }

    return notification;
  } catch (err) {
    console.error('[NotificationService] Error creating notification:', err);
    return null;
  }
};

/**
 * Broadcast real-time assignment response / contribute status to the user's active client tabs
 */
exports.notifyAssignmentStatusUpdated = (userId, eventId, status) => {
  try {
    const io = getIO();
    if (io && userId) {
      io.to(`user_${userId}`).emit('notification:assignment_updated', {
        eventId: eventId ? eventId.toString() : null,
        status,
      });
    }
  } catch (err) {
    console.warn('[NotificationService] Socket notifyAssignmentStatusUpdated warning:', err.message);
  }
};

