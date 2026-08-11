const express = require("express");
const router = express.Router();
const db = require("../db/db");
const { authenticate, requireRole } = require("../middleware/auth");

const VALID_STATUSES = ["Submitted", "Assigned", "In Progress", "Resolved", "Closed"];

// All routes below require a logged-in admin
router.use(authenticate, requireRole("admin"));

// GET /api/admin/complaints?type=&status=&search=  -> list all complaints with optional filters
router.get("/complaints", (req, res) => {
  const { type, status, search } = req.query;
  let sql = `
    SELECT c.*, s.name AS staff_name, u.name AS citizen_name, u.phone AS citizen_phone
    FROM complaints c
    LEFT JOIN staff s ON c.assigned_staff_id = s.id
    LEFT JOIN users u ON c.user_id = u.id
    WHERE 1 = 1
  `;
  const params = [];

  if (type) {
    sql += " AND c.complaint_type = ?";
    params.push(type);
  }
  if (status) {
    sql += " AND c.status = ?";
    params.push(status);
  }
  if (search) {
    sql += " AND (c.description LIKE ? OR u.name LIKE ? OR c.address LIKE ?)";
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  sql += " ORDER BY c.created_at DESC";

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ message: "Could not fetch complaints." });
    res.json(rows);
  });
});

// GET /api/admin/staff -> list of field staff (for assignment dropdown)
router.get("/staff", (req, res) => {
  db.all("SELECT * FROM staff ORDER BY name ASC", [], (err, rows) => {
    if (err) return res.status(500).json({ message: "Could not fetch staff." });
    res.json(rows);
  });
});

// POST /api/admin/staff -> add a new field staff member
router.post("/staff", (req, res) => {
  const { name, phone, designation, zone } = req.body;
  if (!name) return res.status(400).json({ message: "Staff name is required." });

  db.run(
    "INSERT INTO staff (name, phone, designation, zone) VALUES (?, ?, ?, ?)",
    [name, phone || null, designation || null, zone || null],
    function (err) {
      if (err) return res.status(500).json({ message: "Could not add staff." });
      res.status(201).json({ message: "Staff member added.", id: this.lastID });
    }
  );
});

// PUT /api/admin/complaints/:id/assign -> assign complaint to a staff member
router.put("/complaints/:id/assign", (req, res) => {
  const { staff_id } = req.body;
  if (!staff_id) return res.status(400).json({ message: "staff_id is required." });

  db.run(
    `UPDATE complaints SET assigned_staff_id = ?, status = 'Assigned', updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [staff_id, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ message: "Could not assign complaint." });
      if (this.changes === 0) return res.status(404).json({ message: "Complaint not found." });

      db.get("SELECT name FROM staff WHERE id = ?", [staff_id], (err2, staff) => {
        db.run(
          `INSERT INTO complaint_status_history (complaint_id, status, remarks, changed_by)
           VALUES (?, 'Assigned', ?, ?)`,
          [req.params.id, `Assigned to ${staff ? staff.name : "staff member"}.`, req.user.id]
        );
        res.json({ message: "Complaint assigned successfully." });
      });
    }
  );
});

// PUT /api/admin/complaints/:id/status -> update complaint status (In Progress / Resolved / Closed etc.)
router.put("/complaints/:id/status", (req, res) => {
  const { status, remarks } = req.body;
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ message: "Please provide a valid status." });
  }

  db.run(
    `UPDATE complaints SET status = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [status, remarks || null, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ message: "Could not update status." });
      if (this.changes === 0) return res.status(404).json({ message: "Complaint not found." });

      db.run(
        `INSERT INTO complaint_status_history (complaint_id, status, remarks, changed_by)
         VALUES (?, ?, ?, ?)`,
        [req.params.id, status, remarks || null, req.user.id]
      );
      res.json({ message: "Complaint status updated." });
    }
  );
});

// GET /api/admin/stats -> counts for the dashboard
router.get("/stats", (req, res) => {
  const stats = {};
  db.get("SELECT COUNT(*) AS total FROM complaints", [], (err, row) => {
    stats.total = row ? row.total : 0;

    db.all(
      `SELECT status, COUNT(*) AS count FROM complaints GROUP BY status`,
      [],
      (err2, rows) => {
        stats.byStatus = { Submitted: 0, Assigned: 0, "In Progress": 0, Resolved: 0, Closed: 0 };
        (rows || []).forEach((r) => (stats.byStatus[r.status] = r.count));

        db.all(
          `SELECT complaint_type, COUNT(*) AS count FROM complaints GROUP BY complaint_type`,
          [],
          (err3, rows2) => {
            stats.byType = {};
            (rows2 || []).forEach((r) => (stats.byType[r.complaint_type] = r.count));
            res.json(stats);
          }
        );
      }
    );
  });
});

module.exports = router;


// GET /api/admin/database/:table
// Admin-only database viewer
router.get("/database/:table", (req, res) => {
  const { table } = req.params;

  const allowedTables = {
    users: `
      SELECT
        id,
        name,
        email,
        phone,
        role,
        created_at
      FROM users
      ORDER BY id DESC
    `,

    staff: `
      SELECT
        id,
        name,
        phone,
        designation,
        zone,
        created_at
      FROM staff
      ORDER BY id DESC
    `,

    complaints: `
      SELECT
        c.id,
        c.user_id,
        u.name AS citizen_name,
        c.complaint_type,
        c.description,
        c.latitude,
        c.longitude,
        c.address,
        c.status,
        c.assigned_staff_id,
        s.name AS assigned_staff,
        c.remarks,
        c.created_at,
        c.updated_at
      FROM complaints c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN staff s ON c.assigned_staff_id = s.id
      ORDER BY c.id DESC
    `,

    complaint_status_history: `
      SELECT
        h.id,
        h.complaint_id,
        h.status,
        h.remarks,
        h.changed_by,
        u.name AS changed_by_name,
        h.changed_at
      FROM complaint_status_history h
      LEFT JOIN users u ON h.changed_by = u.id
      ORDER BY h.id DESC
    `
  };

  if (!allowedTables[table]) {
    return res.status(400).json({
      message: "Invalid table name."
    });
  }

  db.all(allowedTables[table], [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({
        message: "Could not fetch database records."
      });
    }

    res.json({
      table,
      count: rows.length,
      rows
    });
  });
});