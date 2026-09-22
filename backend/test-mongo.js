const mongoose = require("mongoose");
require("dotenv").config();

console.log("Testing MongoDB connection...");

mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  family: 4
})
.then(() => {
  console.log("MongoDB connected successfully!");
  process.exit(0);
})
.catch((err) => {
  console.log("MongoDB connection failed:");
  console.log(err.message);
  process.exit(1);
});