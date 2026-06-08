const mongoose = require("mongoose");

const ROLE_OPTIONS = [
  "Admin",
  "Worship Leader",
  "Singer",
  "Guitarist",
  "Keyboardist",
  "Drummer",
  "Bassist",
  "Production",
  "Member",
  "Other",
];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    role: { type: String, enum: ROLE_OPTIONS, required: true },
    isAdmin: { type: Boolean, default: false },
    // Manual availability flag: users can toggle this to show available when
    // not connected via socket. This is not the same as online socket presence.
    manualAvailable: { type: Boolean, default: false },
    profilePhotoUrl: { type: String, default: null },
    churchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Church",
      required: true,
    },
    approvalStatus: {
      type: String,
      enum: ["approved", "pending", "rejected"],
      default: "approved",
    },
    approvedAt: { type: Date },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
