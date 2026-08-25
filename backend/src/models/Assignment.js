const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, required: true },
  status: {
    type: String,
    enum: ['assigned', 'accepted', 'declined', 'pending'],
    default: 'assigned'
  },
  notes: String,
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

assignmentSchema.index({ event: 1, user: 1 });
assignmentSchema.index({ user: 1 });

module.exports = mongoose.model('Assignment', assignmentSchema);
