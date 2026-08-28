const mongoose = require('mongoose');

const liveDisplaySchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      default: 'Live Display',
    },
    churchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Church',
      required: true,
      index: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      index: true,
    },
    displayModeOverride: {
      type: String,
      enum: ['DEFAULT', 'LYRICS', 'LYRICS_CHORDS', 'CHORDS'],
      default: 'DEFAULT',
    },
    lastConnectedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LiveDisplay', liveDisplaySchema);
