const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  event: {
    title: { type: String, required: true },
    description: String,
    type: {
      type: String,
      enum: ['service', 'rehearsal', 'seminar', 'wedding', 'baptism', 'other'],
      default: 'service'
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'in_progress', 'completed', 'cancelled'],
      default: 'draft'
    }
  },
  schedule: {
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    timezone: { type: String, default: 'UTC' },
    recurrence: {
      isRecurring: { type: Boolean, default: false },
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'yearly'],
        default: 'weekly'
      },
      endDate: Date
    }
  },
  location: {
    name: String,
    address: String,
    room: String,
    setup: {
      stage: String,
      equipment: [String]
    }
  },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  setlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Song' }],
  assignments: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: String,
    status: {
      type: String,
      enum: ['assigned', 'accepted', 'declined', 'pending'],
      default: 'assigned'
    },
    notes: String
  }],
  chat: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  reminders: [{
    type: { type: String, enum: ['email', 'sms', 'push'], required: true },
    sendAt: { type: Date, required: true },
    sent: { type: Boolean, default: false }
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  churchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Church', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

eventSchema.index({ 'schedule.start': 1 });
eventSchema.index({ team: 1 });
eventSchema.index({ 'event.status': 1 });
eventSchema.index({ churchId: 1 });

module.exports = mongoose.model('Event', eventSchema);
