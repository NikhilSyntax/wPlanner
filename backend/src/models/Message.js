const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  church: { type: mongoose.Schema.Types.ObjectId, ref: 'Church' },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  type: {
    type: String,
    enum: ['text', 'file', 'system'],
    default: 'text'
  },
  fileUrl: String,
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  thread: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  createdAt: { type: Date, default: Date.now }
});

messageSchema.index({ event: 1, createdAt: -1 });
messageSchema.index({ team: 1, createdAt: -1 });
messageSchema.index({ church: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });

module.exports = mongoose.model('Message', messageSchema);
