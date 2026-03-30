require("dotenv").config();

const bcrypt = require("bcrypt");
const db = require("./db/database");

async function seedAdmin() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      throw new Error("ADMIN_PASSWORD is missing from .env");
    }

    db.get(
      `SELECT id, email FROM users WHERE role = 'admin' LIMIT 1`,
      [],
      async (selectErr, existingAdmin) => {
        if (selectErr) {
          console.error("Error checking for existing admin:", selectErr.message);
          return;
        }

        if (existingAdmin) {
          console.log(`Admin already exists: ${existingAdmin.email}`);
          return;
        }

        try {
          const hashedPassword = await bcrypt.hash(adminPassword, 12);

          db.run(
            `INSERT INTO users (full_name, email, password_hash, role, status)
             VALUES (?, ?, ?, ?, ?)`,
            ["System Admin", adminEmail, hashedPassword, "admin", "active"],
            function (insertErr) {
              if (insertErr) {
                console.error("Error seeding admin:", insertErr.message);
              } else {
                console.log("Admin user created with ID:", this.lastID);
                console.log("Admin email:", adminEmail);
              }
            }
          );
        } catch (hashErr) {
          console.error("Hashing error:", hashErr.message);
        }
      }
    );
  } catch (error) {
    console.error("Seed script error:", error.message);
  }
}

seedAdmin();