const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { body, validationResult, param } = require("express-validator");
const db = require("../db/database");
const { requireAdmin, requireTeacherOrAdmin } = require("../middleware/authMiddleware");
const { logAudit } = require("../utils/audit");

const router = express.Router();

router.get("/", requireAdmin, (req, res) => {
  db.all(
    `SELECT
       id,
       full_name,
       email,
       role,
       status,
       date(created_at) AS joined
     FROM users
     ORDER BY created_at DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error("Fetch users error:", err.message);
        return res.status(500).json({
          message: "Could not fetch users"
        });
      }

      return res.json({
        users: rows.map((user) => ({
          id: user.id,
          name: user.full_name,
          email: user.email,
          role: user.role,
          status: user.status,
          joined: user.joined
        }))
      });
    }
  );
});

router.get("/students", requireTeacherOrAdmin, (req, res) => {
  db.all(
    `SELECT
       id,
       full_name,
       email,
       role,
       status,
       date(created_at) AS joined
     FROM users
     WHERE role = 'student'
     ORDER BY full_name ASC`,
    [],
    (err, rows) => {
      if (err) {
        console.error("Fetch students error:", err.message);
        return res.status(500).json({
          message: "Could not fetch students"
        });
      }

      return res.json({
        users: rows.map((user) => ({
          id: user.id,
          name: user.full_name,
          email: user.email,
          role: user.role,
          status: user.status,
          joined: user.joined
        }))
      });
    }
  );
});

router.post(
  "/",
  requireAdmin,
  [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Name is required"),
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email is required"),
    body("role")
      .isIn(["student", "teacher", "admin"])
      .withMessage("Role must be student, teacher, or admin")
  ],
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: "Validation failed",
        errors: errors.array()
      });
    }

    try {
      const { name, email, role } = req.body;
      const tempPassword = `Temp@${crypto.randomBytes(4).toString("hex")}A1`;
      const hashedPassword = await bcrypt.hash(tempPassword, 12);

      db.run(
        `INSERT INTO users (full_name, email, password_hash, role, status)
         VALUES (?, ?, ?, ?, 'active')`,
        [name.trim(), email, hashedPassword, role],
        function (err) {
          if (err) {
            if (err.message.includes("UNIQUE")) {
              return res.status(409).json({
                message: "An account with that email already exists"
              });
            }

            console.error("Create user error:", err.message);
            return res.status(500).json({
              message: "Could not create user"
            });
          }

          logAudit({
            userEmail: req.session.user.email,
            action: "Admin create user",
            status: "success",
            ipAddress: req.ip
          });

          return res.status(201).json({
            message: "User created successfully",
            user: {
              id: this.lastID,
              name: name.trim(),
              email,
              role,
              status: "active"
            },
            temporaryPassword: tempPassword
          });
        }
      );
    } catch (error) {
      console.error("Create user hash error:", error);
      return res.status(500).json({
        message: "Server error"
      });
    }
  }
);

router.patch(
  "/:id/status",
  requireAdmin,
  [
    param("id").isInt().withMessage("User id must be an integer"),
    body("status")
      .isIn(["active", "suspended", "pending"])
      .withMessage("Status must be active, suspended, or pending")
  ],
  (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: "Validation failed",
        errors: errors.array()
      });
    }

    const userId = Number(req.params.id);
    const { status } = req.body;

    if (req.session.user.id === userId) {
      return res.status(400).json({
        message: "You cannot change your own account status"
      });
    }

    db.run(
      `UPDATE users
       SET status = ?
       WHERE id = ?`,
      [status, userId],
      function (err) {
        if (err) {
          console.error("Update status error:", err.message);
          return res.status(500).json({
            message: "Could not update user status"
          });
        }

        if (this.changes === 0) {
          return res.status(404).json({
            message: "User not found"
          });
        }

        logAudit({
          userEmail: req.session.user.email,
          action: `Admin status change to ${status}`,
          status: "success",
          ipAddress: req.ip
        });

        return res.json({
          message: "User status updated successfully"
        });
      }
    );
  }
);

module.exports = router;