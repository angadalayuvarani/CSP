const express = require("express");
const router = express.Router();

const { authenticate, requireRole } = require("../middleware/auth");

const User = require("../models/user");
const Staff = require("../models/staff");
const Complaint = require("../models/complaint");
const ComplaintStatusHistory = require("../models/ComplaintStatusHistory");

const VALID_STATUSES = [
  "Submitted",
  "Assigned",
  "In Progress",
  "Resolved",
  "Closed",
];

// All admin routes require logged-in admin
router.use(authenticate, requireRole("admin"));


// ======================================================
// GET /api/admin/complaints
// List all complaints with filters
// ======================================================

router.get("/complaints", async (req, res) => {
  try {
    const { type, status, search } = req.query;

    const filter = {};

    if (type) {
      filter.complaint_type = type;
    }

    if (status) {
      filter.status = status;
    }

    if (search) {
      const regex = new RegExp(search, "i");

      const users = await User.find({
        $or: [
          { name: regex },
          { phone: regex },
          { email: regex },
        ],
      }).select("_id");

      const userIds = users.map((user) => user._id);

      filter.$or = [
        { description: regex },
        { address: regex },
        { user_id: { $in: userIds } },
      ];
    }

    const complaints = await Complaint.find(filter)
      .populate("assigned_staff_id", "name phone designation zone")
      .populate("user_id", "name phone email")
      .sort({ createdAt: -1 })
      .lean();

    const result = complaints.map((c) => ({
      ...c,

      id: c._id.toString(),

      user_id: c.user_id
        ? c.user_id._id.toString()
        : null,

      assigned_staff_id: c.assigned_staff_id
        ? c.assigned_staff_id._id.toString()
        : null,

      staff_name: c.assigned_staff_id
        ? c.assigned_staff_id.name
        : null,

      staff_phone: c.assigned_staff_id
        ? c.assigned_staff_id.phone
        : null,

      citizen_name: c.user_id
        ? c.user_id.name
        : null,

      citizen_phone: c.user_id
        ? c.user_id.phone
        : null,

      citizen_email: c.user_id
        ? c.user_id.email
        : null,

      created_at: c.createdAt
        ? c.createdAt.toISOString()
        : null,

      updated_at: c.updatedAt
        ? c.updatedAt.toISOString()
        : null,
    }));

    res.json(result);

  } catch (error) {
    console.error("Admin complaints error:", error);

    res.status(500).json({
      message: "Could not fetch complaints.",
    });
  }
});


// ======================================================
// GET /api/admin/staff
// List all field staff
// ======================================================

router.get("/staff", async (req, res) => {
  try {
    const staff = await Staff.find()
      .sort({ name: 1 })
      .lean();

    const result = staff.map((s) => ({
      ...s,
      id: s._id.toString(),
      created_at: s.createdAt
        ? s.createdAt.toISOString()
        : null,
      updated_at: s.updatedAt
        ? s.updatedAt.toISOString()
        : null,
    }));

    res.json(result);

  } catch (error) {
    console.error("Fetch staff error:", error);

    res.status(500).json({
      message: "Could not fetch staff.",
    });
  }
});


// ======================================================
// POST /api/admin/staff
// Add new field staff
// ======================================================

router.post("/staff", async (req, res) => {
  try {
    const {
      name,
      phone,
      designation,
      zone,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        message: "Staff name is required.",
      });
    }

    const staff = await Staff.create({
      name: name.trim(),
      phone: phone || "",
      designation: designation || "",
      zone: zone || "",
    });

    res.status(201).json({
      message: "Staff member added.",
      id: staff._id.toString(),
    });

  } catch (error) {
    console.error("Add staff error:", error);

    res.status(500).json({
      message: "Could not add staff.",
    });
  }
});


// ======================================================
// PUT /api/admin/complaints/:id/assign
// Assign complaint to staff
// ======================================================

router.put("/complaints/:id/assign", async (req, res) => {
  try {
    const { staff_id } = req.body;

    if (!staff_id) {
      return res.status(400).json({
        message: "staff_id is required.",
      });
    }

    const staff = await Staff.findById(staff_id);

    if (!staff) {
      return res.status(404).json({
        message: "Staff member not found.",
      });
    }

    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({
        message: "Complaint not found.",
      });
    }

    complaint.assigned_staff_id = staff._id;
    complaint.status = "Assigned";

    await complaint.save();

    await ComplaintStatusHistory.create({
      complaint_id: complaint._id,
      status: "Assigned",
      remarks: `Assigned to ${staff.name}.`,
      changed_by: req.user.id,
    });

    res.json({
      message: "Complaint assigned successfully.",
    });

  } catch (error) {
    console.error("Assign complaint error:", error);

    res.status(500).json({
      message: "Could not assign complaint.",
    });
  }
});


// ======================================================
// PUT /api/admin/complaints/:id/status
// Update complaint status
// ======================================================

router.put("/complaints/:id/status", async (req, res) => {
  try {
    const {
      status,
      remarks,
    } = req.body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        message: "Please provide a valid status.",
      });
    }

    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({
        message: "Complaint not found.",
      });
    }

    complaint.status = status;
    complaint.remarks = remarks || "";

    await complaint.save();

    await ComplaintStatusHistory.create({
      complaint_id: complaint._id,
      status,
      remarks: remarks || "",
      changed_by: req.user.id,
    });

    res.json({
      message: "Complaint status updated.",
    });

  } catch (error) {
    console.error("Update complaint status error:", error);

    res.status(500).json({
      message: "Could not update status.",
    });
  }
});


// ======================================================
// GET /api/admin/stats
// Dashboard statistics
// ======================================================

router.get("/stats", async (req, res) => {
  try {
    const total = await Complaint.countDocuments();

    const statusCounts = await Complaint.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const typeCounts = await Complaint.aggregate([
      {
        $group: {
          _id: "$complaint_type",
          count: { $sum: 1 },
        },
      },
    ]);

    const byStatus = {
      Submitted: 0,
      Assigned: 0,
      "In Progress": 0,
      Resolved: 0,
      Closed: 0,
    };

    statusCounts.forEach((item) => {
      byStatus[item._id] = item.count;
    });

    const byType = {};

    typeCounts.forEach((item) => {
      byType[item._id] = item.count;
    });

    res.json({
      total,
      byStatus,
      byType,
    });

  } catch (error) {
    console.error("Admin stats error:", error);

    res.status(500).json({
      message: "Could not fetch statistics.",
    });
  }
});


// ======================================================
// GET /api/admin/database/:table
// Admin database viewer
// ======================================================

router.get("/database/:table", async (req, res) => {
  try {
    const { table } = req.params;

    let rows = [];

    // ---------------- USERS ----------------

    if (table === "users") {
      const users = await User.find()
        .select("name email phone role createdAt")
        .sort({ createdAt: -1 })
        .lean();

      rows = users.map((u) => ({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        created_at: u.createdAt
          ? u.createdAt.toISOString()
          : null,
      }));
    }

    // ---------------- STAFF ----------------

    else if (table === "staff") {
      const staff = await Staff.find()
        .sort({ createdAt: -1 })
        .lean();

      rows = staff.map((s) => ({
        id: s._id.toString(),
        name: s.name,
        phone: s.phone,
        designation: s.designation,
        zone: s.zone,
        created_at: s.createdAt
          ? s.createdAt.toISOString()
          : null,
      }));
    }

    // ---------------- COMPLAINTS ----------------

    else if (table === "complaints") {
      const complaints = await Complaint.find()
        .populate("user_id", "name phone")
        .populate("assigned_staff_id", "name")
        .sort({ createdAt: -1 })
        .lean();

      rows = complaints.map((c) => ({
        id: c._id.toString(),

        user_id: c.user_id
          ? c.user_id._id.toString()
          : null,

        citizen_name: c.user_id
          ? c.user_id.name
          : null,

        complaint_type: c.complaint_type,
        description: c.description,
        latitude: c.latitude,
        longitude: c.longitude,
        address: c.address,
        status: c.status,

        assigned_staff_id: c.assigned_staff_id
          ? c.assigned_staff_id._id.toString()
          : null,

        assigned_staff: c.assigned_staff_id
          ? c.assigned_staff_id.name
          : null,

        remarks: c.remarks,

        created_at: c.createdAt
          ? c.createdAt.toISOString()
          : null,

        updated_at: c.updatedAt
          ? c.updatedAt.toISOString()
          : null,
      }));
    }

    // ---------------- STATUS HISTORY ----------------

    else if (table === "complaint_status_history") {
      const history = await ComplaintStatusHistory.find()
        .populate("changed_by", "name")
        .sort({ createdAt: -1 })
        .lean();

      rows = history.map((h) => ({
        id: h._id.toString(),

        complaint_id: h.complaint_id.toString(),

        status: h.status,

        remarks: h.remarks,

        changed_by: h.changed_by
          ? h.changed_by._id.toString()
          : null,

        changed_by_name: h.changed_by
          ? h.changed_by.name
          : null,

        changed_at: h.createdAt
          ? h.createdAt.toISOString()
          : null,
      }));
    }

    else {
      return res.status(400).json({
        message: "Invalid table name.",
      });
    }

    res.json({
      table,
      count: rows.length,
      rows,
    });

  } catch (error) {
    console.error("Database viewer error:", error);

    res.status(500).json({
      message: "Could not fetch database records.",
    });
  }
});


module.exports = router;