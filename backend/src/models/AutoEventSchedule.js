const mongoose = require('mongoose');

const autoEventScheduleSchema = new mongoose.Schema({
  churchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Church',
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  frequency: {
    type: String,
    enum: ['weekly', 'monthly'],
    required: true,
    default: 'weekly',
  },
  // For weekly: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  dayOfWeek: {
    type: Number,
    min: 0,
    max: 6,
  },
  // For monthly: which week (1st, 2nd, 3rd, 4th, 5th/last)
  weekOfMonth: {
    type: Number,
    min: 1,
    max: 5,
  },
  // For monthly: fixed date (1–31)
  dayOfMonth: {
    type: Number,
    min: 1,
    max: 31,
  },
  // HH:mm 24-hour format
  startTime: {
    type: String,
    required: true,
    match: /^\d{2}:\d{2}$/,
  },
  endTime: {
    type: String,
    required: true,
    match: /^\d{2}:\d{2}$/,
  },
  timezone: {
    type: String,
    default: 'Asia/Kolkata',
  },
  eventType: {
    type: String,
    enum: ['service', 'rehearsal', 'seminar', 'wedding', 'baptism', 'other'],
    default: 'service',
  },
  // Generate the event N days before the occurrence
  creationOffsetDays: {
    type: Number,
    default: 3,
    min: 1,
    max: 14,
  },
  reminders: [{
    offsetDays: { type: Number, required: true },
    enabled: { type: Boolean, default: true },
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

autoEventScheduleSchema.index({ churchId: 1, isActive: 1 });
autoEventScheduleSchema.index({ churchId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('AutoEventSchedule', autoEventScheduleSchema);
