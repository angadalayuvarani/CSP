// Run with: npm run seed
// Creates a default admin login and a few sample field-staff records.
require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("./db");

const ADMIN_EMAIL = "admin@aquatrack.gov.in";
const ADMIN_PASSWORD = "Admin@123";

setTimeout(() => {
  db.get("SELECT id FROM users WHERE email = ?", [ADMIN_EMAIL], (err, row) => {
    if (err) return console.error(err);

    if (row) {
      console.log("Default admin already exists:", ADMIN_EMAIL);
    } else {
      const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
      db.run(
        `INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'admin')`,
        ["Portal Administrator", ADMIN_EMAIL, "9999999999", hash],
        function (err2) {
          if (err2) return console.error(err2);
          console.log("Default admin created:");
          console.log("  email   :", ADMIN_EMAIL);
          console.log("  password:", ADMIN_PASSWORD);
        }
      );
    }
  });

  const staffList = [
    ["Ravi Kumar", "9876500001", "Field Technician", "Zone 1"],
    ["Sunita Reddy", "9876500002", "Field Technician", "Zone 2"],
    ["Manohar Rao", "9876500003", "Plumbing Supervisor", "Zone 3"],
    ["Lakshmi Devi", "9876500004", "Water Quality Inspector", "Zone 1"],
  ];

  db.get("SELECT COUNT(*) as count FROM staff", [], (err, row) => {
    if (err) return console.error(err);
    if (row.count > 0) {
      console.log("Staff table already has records, skipping seed.");
      return;
    }
    const stmt = db.prepare(
      "INSERT INTO staff (name, phone, designation, zone) VALUES (?, ?, ?, ?)"
    );
    staffList.forEach((s) => stmt.run(s));
    stmt.finalize(() => console.log("Sample staff records inserted."));
  });
}, 500);
