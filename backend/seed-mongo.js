require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("./models/User");

async function seedAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      family: 4,
      serverSelectionTimeoutMS: 10000
    });

    console.log("MongoDB connected!");

    const email = "admin@aquatrack.gov.in";
    const password = "Admin@123";

    const existingAdmin = await User.findOne({ email });

    if (existingAdmin) {
      console.log("Admin already exists in MongoDB.");
    } else {
      const passwordHash = bcrypt.hashSync(password, 10);

      await User.create({
        name: "Portal Administrator",
        email,
        phone: "9999999999",
        password_hash: passwordHash,
        role: "admin"
      });

      console.log("MongoDB admin created successfully!");
      console.log("Email:", email);
      console.log("Password:", password);
    }

    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    console.error("MongoDB seed failed:");
    console.error(error.message);
    process.exit(1);
  }
}

seedAdmin();