const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    phone: {
      type: String,
      default: ""
    },

    password_hash: {
      type: String,
      required: true
    },

    role: {
      type: String,
      enum: ["citizen", "admin"],
      default: "citizen"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("User", userSchema);