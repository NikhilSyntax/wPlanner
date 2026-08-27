const Notification = require('../models/Notification');
const Event = require('../models/Event');
const Assignment = require('../models/Assignment');
const Team = require('../models/Team');
const Song = require('../models/Song');
const { getVapidPublicKey, subscribeUser, unsubscribeUser, sendPushToUser } = require('../utils/pushService');
const { sendNotification } = require('../utils/notificationService');

// Get notifications for current user
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { read, type, limit = 20, page = 1 } = req.query;
    const filter = { recipient: userId };
    if (read !== undefined) filter.read = read === 'true';
    if (type) filter.type = type;

    const skip = (page - 1) * limit;
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('type title message link read createdAt actionStatus eventId assignmentRole');

    const total = await Notification.countDocuments(filter);
    const unreadCount = await Notification.countDocuments({ recipient: userId, read: false });

    res.json({
      notifications,
      unreadCount,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Mark a notification as read
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.userId },
      { $set: { read: true } },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    res.json(notification);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Mark all as read
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.userId, read: false },
      { $set: { read: true } }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create notification (admin or system)
exports.createNotification = async (req, res) => {
  try {
    const { recipientId, type, title, message, link } = req.body;
    const notification = await sendNotification({
      recipientId,
      type: type || 'system',
      title,
      message,
      link,
    });
    if (!notification) {
      return res.status(400).json({ message: 'Missing required notification fields' });
    }
    res.status(201).json(notification);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user.userId,
    });
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/notifications/vapid-public-key
exports.getVapidPublicKey = async (req, res) => {
  try {
    const publicKey = getVapidPublicKey();
    res.json({ publicKey });
  } catch (err) {
    console.error('[WebPush] Error getting VAPID public key:', err);
    res.status(500).json({ message: 'Failed to retrieve VAPID key' });
  }
};

// POST /api/notifications/push-subscribe
exports.subscribePush = async (req, res) => {
  try {
    const userId = req.user.userId;
    const subscriptionData = req.body.subscription || req.body;
    const userAgent = req.headers['user-agent'] || '';

    const sub = await subscribeUser(userId, subscriptionData, userAgent);
    res.status(201).json({ success: true, subscription: sub });
  } catch (err) {
    console.error('[WebPush] Subscribe error:', err);
    res.status(400).json({ message: err.message || 'Failed to save push subscription' });
  }
};

// POST /api/notifications/push-unsubscribe
exports.unsubscribePush = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ message: 'Missing endpoint' });
    }

    await unsubscribeUser(userId, endpoint);
    res.json({ success: true, message: 'Unsubscribed from push notifications' });
  } catch (err) {
    console.error('[WebPush] Unsubscribe error:', err);
    res.status(500).json({ message: 'Failed to unsubscribe' });
  }
};

// POST /api/notifications/test-push
exports.sendTestPush = async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await sendPushToUser(userId, {
      title: 'wPlanner Worship Alert 🎵',
      message: 'Push notifications are working perfectly on your device!',
      link: '/dashboard',
      type: 'system',
    });

    if (result.sent === 0) {
      return res.status(400).json({
        message: 'No active push subscriptions found for your account. Please enable notifications on this device first.',
      });
    }

    res.json({
      success: true,
      message: `Test push sent to ${result.sent} device(s)!`,
      result,
    });
  } catch (err) {
    console.error('[WebPush] Test push error:', err);
    res.status(500).json({ message: err.message || 'Failed to send test push' });
  }
};

// POST /api/notifications/:id/respond
// Accept or reject/decline an assignment notification
exports.respondToNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, status } = req.body;
    let normalizedStatus = status;
    if (!normalizedStatus && action) {
      normalizedStatus =
        action === 'accept' || action === 'approve' || action === 'accepted'
          ? 'accepted'
          : 'declined';
    }
    if (!['accepted', 'declined'].includes(normalizedStatus)) {
      return res.status(400).json({ message: 'Invalid action. Use "accept" or "decline".' });
    }

    if (req.user?.role === 'admin' || req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admins cannot accept or decline team assignments.' });
    }

    const notification = await Notification.findOne({
      _id: id,
      recipient: req.user.userId,
    });
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    notification.actionStatus = normalizedStatus;
    notification.read = true;
    await notification.save();

    // If associated with an event, update event assignments and Assignment document
    let eventId = notification.eventId;
    if (!eventId && notification.link) {
      const match = notification.link.match(/[a-fA-F0-9]{24}/);
      if (match) eventId = match[0];
    }

    let populatedEvent = null;
    if (eventId) {
      const event = await Event.findOne({
        _id: eventId,
        churchId: req.user.churchId,
      });

      if (event) {
        const userId = req.user.userId;
        const idx = event.assignments.findIndex((a) => {
          const uid = a.userId?._id ? a.userId._id.toString() : a.userId?.toString();
          return uid === userId.toString();
        });

        if (idx !== -1) {
          event.assignments[idx].status = normalizedStatus;
        } else {
          event.assignments.push({
            userId,
            role: notification.assignmentRole || 'Team Member',
            status: normalizedStatus,
          });
        }
        event.updatedAt = new Date();
        await event.save();

        await Assignment.findOneAndUpdate(
          { event: event._id, user: userId },
          {
            status: normalizedStatus,
            updatedAt: Date.now(),
            $setOnInsert: {
              role: notification.assignmentRole || 'Team Member',
              assignedBy: userId,
            },
          },
          { upsert: true }
        );

        // Sync all related assignment notifications for this user and event
        await Notification.updateMany(
          {
            recipient: userId,
            _id: { $ne: notification._id },
            $or: [{ eventId: event._id }, { link: new RegExp(event._id.toString()) }],
          },
          { $set: { actionStatus: normalizedStatus, read: true } }
        );

        populatedEvent = await Event.findById(event._id)
          .populate('team', 'team.name members')
          .populate('assignments.userId', 'name email role profilePhotoUrl')
          .populate('setlist', 'title artist key timeSignature')
          .lean();
      }
    }

    res.json({
      success: true,
      notification,
      status: normalizedStatus,
      eventId: eventId || null,
      event: populatedEvent,
    });
  } catch (err) {
    console.error('[NotificationController] Error responding to notification:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
