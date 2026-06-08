// models/Church.js
const mongoose = require("mongoose");

const churchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    churchCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
      uppercase: true,
      minlength: 6,
      maxlength: 6,
      match: /^[A-Z0-9]{6}$/,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Church", churchSchema);
