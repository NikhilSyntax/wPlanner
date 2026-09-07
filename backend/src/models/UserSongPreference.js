const mongoose = require('mongoose');

const userSongPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    songId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Song',
      required: true,
      index: true,
    },
    churchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Church',
      required: true,
      index: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
    },
    transpose: {
      type: Number,
      default: 0,
    },
    capo: {
      type: Number,
      default: 0,
    },
    chords: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Enforce single preference per user per song
userSongPreferenceSchema.index({ userId: 1, songId: 1 }, { unique: true });

module.exports = mongoose.model('UserSongPreference', userSongPreferenceSchema);
