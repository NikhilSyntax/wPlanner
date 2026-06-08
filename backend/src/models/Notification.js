const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['event_reminder', 'assignment', 'setlist_update', 'chat_mention', 'system'],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  link: String,
  read: { type: Boolean, default: false },
  sentVia: [{ type: String, enum: ['email', 'sms', 'push'] }],
  createdAt: { type: Date, default: Date.now }
});

notificationSchema.index({ recipient: 1, read: 1 });
notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
