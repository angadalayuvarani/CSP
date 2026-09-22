require("dotenv").config();
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcryptjs");

const DB_PATH = path.join(__dirname, "aquatrack.sqlite");

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("Failed to connect to database:", err.message);
  } else {
    console.log("Connected to SQLite database at", DB_PATH);
  }
});

db.serialize(() => {
  db.run("PRAGMA foreign_keys = ON");

  // Users table: stores both citizens and admins
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'citizen'
        CHECK(role IN ('citizen', 'admin')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create default department/admin account
  const adminPasswordHash = bcrypt.hashSync("Admin@123", 10);

  db.run(
    `INSERT OR IGNORE INTO users
      (name, email, phone, password_hash, role)
     VALUES (?, ?, ?, ?, 'admin')`,
    [
      "Portal Administrator",
      "admin@aquatrack.gov.in",
      "9999999999",
      adminPasswordHash
    ],
    (err) => {
      if (err) {
        console.error("Could not create default admin:", err.message);
      } else {
        console.log(
          "Default admin checked: admin@aquatrack.gov.in"
        );
      }
    }
  );

  // Staff table: water department field staff
  db.run(`
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      designation TEXT,
      zone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Complaints table
  db.run(`
    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      complaint_type TEXT NOT NULL CHECK(complaint_type IN
        ('Water Leakage', 'Water Overflow', 'Water Contamination', 'Low Water Pressure')),
      description TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      address TEXT,
      image_path TEXT,
      status TEXT NOT NULL DEFAULT 'Submitted' CHECK(status IN
        ('Submitted', 'Assigned', 'In Progress', 'Resolved', 'Closed')),
      assigned_staff_id INTEGER,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_staff_id) REFERENCES staff(id) ON DELETE SET NULL
    )
  `);

  // Complaint status history: audit trail
  db.run(`
    CREATE TABLE IF NOT EXISTS complaint_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      remarks TEXT,
      changed_by INTEGER,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
      FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  console.log("Database schema ready.");
});

module.exports = db;