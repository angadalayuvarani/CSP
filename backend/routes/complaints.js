const express = require("express");
const router = express.Router();
const db = require("../db/db");
const { authenticate, requireRole } = require("../middleware/auth");
const upload = require("../middleware/upload");

const VALID_TYPES = [
  "Water Leakage",
  "Water Overflow",
  "Water Contamination",
  "Low Water Pressure",
];

// POST /api/complaints  -> citizen submits a new complaint (with optional image)
router.post(
  "/",
  authenticate,
  requireRole("citizen"),
  upload.single("image"),
  (req, res) => {
    const { complaint_type, description, latitude, longitude, address } = req.body;

    if (!complaint_type || !VALID_TYPES.includes(complaint_type)) {
      return res.status(400).json({ message: "Please select a valid complaint type." });
    }
    if (!description || description.trim().length < 5) {
      return res.status(400).json({ message: "Please provide a description of the problem." });
    }

    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    db.run(
      `INSERT INTO complaints
        (user_id, complaint_type, description, latitude, longitude, address, image_path, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Submitted')`,
      [
        req.user.id,
        complaint_type,
        description.trim(),
        latitude || null,
        longitude || null,
        address || null,
        imagePath,
      ],
      function (err) {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: "Could not submit complaint." });
        }
        const complaintId = this.lastID;

        db.run(
          `INSERT INTO complaint_status_history (complaint_id, status, remarks, changed_by)
           VALUES (?, 'Submitted', 'Complaint registered by citizen.', ?)`,
          [complaintId, req.user.id]
        );

        return res.status(201).json({
          message: "Complaint submitted successfully.",
          complaint_id: complaintId,
        });
      }
    );
  }
);

// GET /api/complaints/mine  -> citizen's own complaints
router.get("/mine", authenticate, requireRole("citizen"), (req, res) => {
  db.all(
    `SELECT c.*, s.name AS staff_name, s.phone AS staff_phone
     FROM complaints c
     LEFT JOIN staff s ON c.assigned_staff_id = s.id
     WHERE c.user_id = ?
     ORDER BY c.created_at DESC`,
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ message: "Could not fetch complaints." });
      res.json(rows);
    }
  );
});

// GET /api/complaints/:id  -> detail view (citizen can only view their own; admin can view any)
router.get("/:id", authenticate, (req, res) => {
  db.get(
    `SELECT c.*, s.name AS staff_name, s.phone AS staff_phone, u.name AS citizen_name, u.phone AS citizen_phone
     FROM complaints c
     LEFT JOIN staff s ON c.assigned_staff_id = s.id
     LEFT JOIN users u ON c.user_id = u.id
     WHERE c.id = ?`,
    [req.params.id],
    (err, complaint) => {
      if (err) return res.status(500).json({ message: "Server error." });
      if (!complaint) return res.status(404).json({ message: "Complaint not found." });

      if (req.user.role === "citizen" && complaint.user_id !== req.user.id) {
        return res.status(403).json({ message: "You cannot view this complaint." });
      }

      db.all(
        `SELECT * FROM complaint_status_history WHERE complaint_id = ? ORDER BY changed_at ASC`,
        [req.params.id],
        (err2, history) => {
          if (err2) return res.status(500).json({ message: "Server error." });
          res.json({ ...complaint, history });
        }
      );
    }
  );
});

module.exports = router;
