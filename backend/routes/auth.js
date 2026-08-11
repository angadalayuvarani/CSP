const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const router = express.Router();
const db = require("../db/db");
require("dotenv").config();

// POST /api/auth/register  -> citizen self-registration
router.post("/register", (req, res) => {
  const { name, email, phone, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required." });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters." });
  }

  db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
    if (err) return res.status(500).json({ message: "Server error." });
    if (row) return res.status(409).json({ message: "An account with this email already exists." });

    const hash = bcrypt.hashSync(password, 10);
    db.run(
      `INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'citizen')`,
      [name, email, phone || null, hash],
      function (err2) {
        if (err2) return res.status(500).json({ message: "Could not create account." });
        return res.status(201).json({ message: "Account created successfully. Please log in." });
      }
    );
  });
});

// POST /api/auth/login  -> works for both citizen and admin, role decided by DB record
router.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if (err) return res.status(500).json({ message: "Server error." });
    if (!user) return res.status(401).json({ message: "Invalid email or password." });

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: "Invalid email or password." });

    const payload = { id: user.id, name: user.name, email: user.email, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "8h" });

    return res.json({ token, user: payload });
  });
});

module.exports = router;
