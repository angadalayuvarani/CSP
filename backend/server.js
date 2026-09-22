const connectMongoDB = require("./config/mongodb");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth");
const complaintRoutes = require("./routes/complaints");
const adminRoutes = require("./routes/admin");
 // initializes schema on startup

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded complaint images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Serve the frontend (so the whole project can run from one server)
app.use(express.static(path.join(__dirname, "..", "frontend")));

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/admin", adminRoutes);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Fallback: any non-API GET request serves the frontend's index.html
app.get(/^(?!\/api|\/uploads).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

// Central error handler (e.g. multer file-size/type errors)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: err.message || "Something went wrong on the server." });
});
connectMongoDB();
app.listen(PORT, () => {
  console.log(`AquaTrack backend running on http://localhost:${PORT}`);
});
