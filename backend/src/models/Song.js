const mongoose = require("mongoose");

const songSchema = new mongoose.Schema({
  churchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Church', required: true, index: true },
  title: { type: String, required: true },
  artist: String,
  album: String,
  year: Number,
  key: {
    type: String,
    enum: ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"],
    default: "C",
  },
  bpm: Number,
  timeSignature: {
    type: String,
    enum: ["2/4", "3/4", "4/4", "5/4", "6/8", "7/8"],
    default: "4/4",
  },
  genre: [String],
  tags: [String],
  copyright: {
    owner: String,
    year: Number,
    license: {
      type: String,
      enum: [
        "public_domain",
        "cc_by",
        "cc_by_sa",
        "cc_by_nc",
        "cc_by_nc_sa",
        "copyrighted",
        "other",
      ],
      default: "copyrighted",
    },
  },
  media: {
    audio: String,
    video: String,
    chord: String,
    lyric: String,
  },
  versions: [
    {
      key: String,
      tempo: Number,
      arrangement: {
        vocals: String,
        drums: String,
        guitar: String,
        keyboard: String,
      },
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      createdAt: { type: Date, default: Date.now },
    },
  ],
  usage: {
    timesPerformed: { type: Number, default: 0 },
    lastPerformed: Date,
    usageHistory: [
      {
        eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
        eventTitle: String,
        usedAt: { type: Date, default: Date.now },
        key: { type: String, default: "C" },
      },
    ],
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  content: {
    lyrics: { type: String },
    chords: { type: String },
    tabs: { type: String },
  },
  metadata: {
    version: { type: Number, default: 1 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
});

songSchema.index({ title: 1 });
songSchema.index({ artist: 1 });
songSchema.index({ key: 1 });
songSchema.index({ genre: 1 });
songSchema.index({ "content.lyrics": "text" });

module.exports = mongoose.model("Song", songSchema);
