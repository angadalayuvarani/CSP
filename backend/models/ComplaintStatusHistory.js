const mongoose = require("mongoose");

const complaintStatusHistorySchema = new mongoose.Schema(
  {
    complaint_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Complaint",
      required: true
    },

    status: {
      type: String,
      required: true
    },

    remarks: {
      type: String,
      default: ""
    },

    changed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  "ComplaintStatusHistory",
  complaintStatusHistorySchema
);