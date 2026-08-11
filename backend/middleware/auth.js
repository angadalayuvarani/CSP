const jwt = require("jsonwebtoken");
require("dotenv").config();

// Verifies the JWT sent in the Authorization header and attaches the user to req.user
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided. Please log in." });
  }

  const token = header.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, name, email, role }
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token. Please log in again." });
  }
}

// Restricts a route to a specific role, e.g. requireRole("admin")
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ message: "You do not have permission to access this resource." });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
