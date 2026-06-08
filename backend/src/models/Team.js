const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  team: {
    name: { type: String, required: true },
    description: String,
    type: {
      type: String,
      enum: ['worship_band', 'production', 'choir', 'youth', 'children', 'media', 'technical', 'other'],
      default: 'other'
    }
  },
  churchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Church', required: true },
  church: {
    name: String,
    location: String,
    timezone: String
  },
  members: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    roles: [{
      type: String,
      enum: ['lead_singer', 'guitar', 'bass', 'drums', 'keys', 'vocals', 'production', 'lighting', 'audio', 'video', 'admin', 'leader']
    }],
    joinedAt: { type: Date, default: Date.now }
  }],
  settings: {
    notifications: {
      default: Boolean,
      email: Boolean,
      push: Boolean
    },
    visibility: {
      type: String,
      enum: ['private', 'team', 'public'],
      default: 'team'
    },
    autoAcceptance: {
      type: Boolean,
      default: false
    }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

teamSchema.index({ 'team.name': 1 });
teamSchema.index({ 'team.type': 1 });
teamSchema.index({ 'members.userId': 1 });

module.exports = mongoose.model('Team', teamSchema);
