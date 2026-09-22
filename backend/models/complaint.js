const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    complaint_type: {
      type: String,
      required: true
    },

    description: {
      type: String,
      required: true
    },

    latitude: {
      type: Number,
      default: null
    },

    longitude: {
      type: Number,
      default: null
    },

    address: {
      type: String,
      default: ""
    },

    image_path: {
      type: String,
      default: ""
    },

    status: {
      type: String,
      default: "Submitted"
    },

    assigned_staff_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      default: null
    },

    remarks: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

module.exports =
  mongoose.models.Complaint || mongoose.model("Complaint", complaintSchema);