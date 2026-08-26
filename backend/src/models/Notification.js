const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: [
      'event_reminder',
      'assignment',
      'setlist_update',
      'chat_mention',
      'system',
      'event_draft',
      'event_confirmed',
    ],
    required: true,
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  link: String,
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  actionStatus: {
    type: String,
    enum: ['pending', 'accepted', 'declined', null],
    default: null,
  },
  assignmentRole: String,
  read: { type: Boolean, default: false },
  sentVia: [{ type: String, enum: ['in_app', 'push', 'email', 'sms', 'socket'] }],
  createdAt: { type: Date, default: Date.now }
});

notificationSchema.index({ recipient: 1, read: 1 });
notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
