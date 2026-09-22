
const express = require("express");
const router = express.Router();

const { authenticate, requireRole } = require("../middleware/auth");
const upload = require("../middleware/upload");

require("../models/Staff");

const Complaint = require("../models/Complaint");
const ComplaintStatusHistory = require("../models/ComplaintStatusHistory");

const VALID_TYPES = [
  "Water Leakage",
  "Water Overflow",
  "Water Contamination",
  "Low Water Pressure",
];

// POST /api/complaints
// Citizen submits a new complaint
router.post(
  "/",
  authenticate,
  requireRole("citizen"),
  upload.single("image"),
  async (req, res) => {
    try {
      const {
        complaint_type,
        description,
        latitude,
        longitude,
        address,
      } = req.body;

      if (!complaint_type || !VALID_TYPES.includes(complaint_type)) {
        return res.status(400).json({
          message: "Please select a valid complaint type.",
        });
      }

      if (!description || description.trim().length < 5) {
        return res.status(400).json({
          message: "Please provide a description of the problem.",
        });
      }

      const imagePath = req.file
        ? "/uploads/" + req.file.filename
        : "";

      const complaint = await Complaint.create({
        user_id: req.user.id,
        complaint_type: complaint_type,
        description: description.trim(),
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
        address: address || "",
        image_path: imagePath,
        status: "Submitted",
      });

      await ComplaintStatusHistory.create({
        complaint_id: complaint._id,
        status: "Submitted",
        remarks: "Complaint registered by citizen.",
        changed_by: req.user.id,
      });

      return res.status(201).json({
        message: "Complaint submitted successfully.",
        complaint_id: complaint._id.toString(),
      });
    } catch (error) {
      console.error("Complaint submission error:", error);

      return res.status(500).json({
        message: "Could not submit complaint.",
      });
    }
  }
);

// GET /api/complaints/mine
// Citizen's own complaints
router.get(
  "/mine",
  authenticate,
  requireRole("citizen"),
  async (req, res) => {
    try {
      const complaints = await Complaint.find({
        user_id: req.user.id,
      })
        .populate("assigned_staff_id", "name phone")
        .sort({ createdAt: -1 })
        .lean();

      const result = complaints.map((complaint) => {
        return {
          ...complaint,

          id: complaint._id.toString(),

          user_id: complaint.user_id.toString(),

          assigned_staff_id: complaint.assigned_staff_id
            ? complaint.assigned_staff_id._id.toString()
            : null,

          staff_name: complaint.assigned_staff_id
            ? complaint.assigned_staff_id.name
            : null,

          staff_phone: complaint.assigned_staff_id
            ? complaint.assigned_staff_id.phone
            : null,

          created_at: complaint.createdAt
            ? complaint.createdAt.toISOString()
            : null,

          updated_at: complaint.updatedAt
            ? complaint.updatedAt.toISOString()
            : null,
        };
      });

      return res.json(result);
    } catch (error) {
      console.error("Fetch complaints error:", error);

      return res.status(500).json({
        message: "Could not fetch complaints.",
      });
    }
  }
);

// GET /api/complaints/:id
// Citizen can view own complaint
// Admin can view any complaint
router.get("/:id", authenticate, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate("assigned_staff_id", "name phone")
      .populate("user_id", "name phone")
      .lean();

    if (!complaint) {
      return res.status(404).json({
        message: "Complaint not found.",
      });
    }

    const complaintUserId = complaint.user_id
      ? complaint.user_id._id.toString()
      : null;

    if (
      req.user.role === "citizen" &&
      complaintUserId !== req.user.id.toString()
    ) {
      return res.status(403).json({
        message: "You cannot view this complaint.",
      });
    }

    const history = await ComplaintStatusHistory.find({
      complaint_id: complaint._id,
    })
      .populate("changed_by", "name email")
      .sort({ createdAt: 1 })
      .lean();

    const result = {
      ...complaint,

      id: complaint._id.toString(),

      user_id: complaint.user_id
        ? complaint.user_id._id.toString()
        : null,

      assigned_staff_id: complaint.assigned_staff_id
        ? complaint.assigned_staff_id._id.toString()
        : null,

      staff_name: complaint.assigned_staff_id
        ? complaint.assigned_staff_id.name
        : null,

      staff_phone: complaint.assigned_staff_id
        ? complaint.assigned_staff_id.phone
        : null,

      citizen_name: complaint.user_id
        ? complaint.user_id.name
        : null,

      citizen_phone: complaint.user_id
        ? complaint.user_id.phone
        : null,

      created_at: complaint.createdAt
        ? complaint.createdAt.toISOString()
        : null,

      updated_at: complaint.updatedAt
        ? complaint.updatedAt.toISOString()
        : null,

      history: history.map((item) => {
        return {
          ...item,

          id: item._id.toString(),

          complaint_id: item.complaint_id.toString(),

          changed_by: item.changed_by
            ? item.changed_by._id.toString()
            : null,

          changed_at: item.createdAt
            ? item.createdAt.toISOString()
            : null,
        };
      }),
    };

    return res.json(result);
  } catch (error) {
    console.error("Fetch complaint detail error:", error);

    return res.status(500).json({
      message: "Server error.",
    });
  }
});

module.exports = router;

