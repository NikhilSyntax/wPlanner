const mongoose = require('mongoose');

const liveSessionSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    churchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Church',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['NOT_STARTED', 'LIVE', 'PAUSED', 'ENDED'],
      default: 'LIVE',
    },
    pairingCode: {
      type: String,
      required: true,
      index: true,
    },
    currentSongId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Song',
      default: null,
    },
    currentSongTitle: {
      type: String,
      default: '',
    },
    currentSongKey: {
      type: String,
      default: 'C',
    },
    currentSectionId: {
      type: String,
      default: '',
    },
    currentSectionName: {
      type: String,
      default: '',
    },
    currentChunkIndex: {
      type: Number,
      default: 0, // 0-indexed 2-line slide/page within the current section
    },
    displayMode: {
      type: String,
      enum: ['LYRICS_CHORDS', 'LYRICS', 'CHORDS', 'BLACK', 'CLEAR'],
      default: 'LYRICS_CHORDS',
    },
    // Optional live arrangement overrides per song: { [songId]: ['sec_1', 'sec_2', 'sec_2', 'sec_3'] }
    liveArrangements: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Custom live slide edits during live presentation
    customChunkOverrides: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Hidden / deleted slides during live presentation: { [slideKey]: true }
    hiddenSlides: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Active presentation language: 'original' or language name (e.g. 'Spanish', 'Tamil', etc.) or 'split'
    activeLanguage: {
      type: String,
      default: 'original',
    },
    isSplitView: {
      type: Boolean,
      default: false,
    },
    splitLanguage: {
      type: String,
      default: '',
    },
    connectedDisplays: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

liveSessionSchema.index({ eventId: 1, churchId: 1 });

module.exports = mongoose.model('LiveSession', liveSessionSchema);
