const express = require("express");
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
const db = require("../db/database");
const { requireAuth } = require("../middleware/authMiddleware");
const { logAudit } = require("../utils/audit");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  message: {
    message: "Too many login attempts. Please try again later."
  },
  standardHeaders: true,
  legacyHeaders: false
});

router.post(
  "/register",
  [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Name is required"),
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Invalid email format"),
    body("role")
      .isIn(["student", "teacher"])
      .withMessage("Role must be student or teacher"),
    body("password")
      .isLength({ min: 12 })
      .withMessage("Password must be at least 12 characters")
      .matches(/[A-Z]/)
      .withMessage("Password must contain at least one uppercase letter")
      .matches(/[a-z]/)
      .withMessage("Password must contain at least one lowercase letter")
      .matches(/[0-9]/)
      .withMessage("Password must contain at least one number")
      .matches(/[^A-Za-z0-9]/)
      .withMessage("Password must contain at least one symbol"),
    body("confirmPassword")
      .notEmpty()
      .withMessage("Confirm password is required")
  ],
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: "Validation failed",
        errors: errors.array()
      });
    }

    const { name, email, role, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match"
      });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 12);

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

            console.error("Register error:", err.message);
            return res.status(500).json({
              message: "Could not create account"
            });
          }

          logAudit({
            userEmail: email,
            action: "Register",
            status: "success",
            ipAddress: req.ip
          });

          return res.status(201).json({
            message: "Account created successfully. You can now sign in."
          });
        }
      );
    } catch (error) {
      console.error("Register hash error:", error);
      return res.status(500).json({
        message: "Server error"
      });
    }
  }
);

router.post(
  "/login",
  loginLimiter,
  [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Invalid email format"),
    body("password")
      .notEmpty()
      .withMessage("Password is required")
  ],
  (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: "Validation failed",
        errors: errors.array()
      });
    }

    const { email, password } = req.body;
    const ipAddress = req.ip;

    db.get(
      "SELECT * FROM users WHERE email = ?",
      [email],
      async (err, user) => {
        if (err) {
          console.error("Login DB error:", err.message);
          return res.status(500).json({
            message: "Server error"
          });
        }

        if (!user) {
          logAudit({
            userEmail: email,
            action: "Login",
            status: "failed",
            ipAddress
          });

          return res.status(401).json({
            message: "Invalid credentials"
          });
        }

        if (user.status === "pending") {
          logAudit({
            userEmail: email,
            action: "Login",
            status: "blocked_pending",
            ipAddress
          });

          return res.status(403).json({
            message: "Account pending admin approval"
          });
        }

        if (user.status === "suspended") {
          logAudit({
            userEmail: email,
            action: "Login",
            status: "blocked_suspended",
            ipAddress
          });

          return res.status(403).json({
            message: "Account is suspended"
          });
        }

        const match = await bcrypt.compare(password, user.password_hash);

        if (!match) {
          logAudit({
            userEmail: email,
            action: "Login",
            status: "failed",
            ipAddress
          });

          return res.status(401).json({
            message: "Invalid credentials"
          });
        }

        req.session.regenerate((sessionErr) => {
          if (sessionErr) {
            console.error("Session regeneration error:", sessionErr);
            return res.status(500).json({
              message: "Session error"
            });
          }

          req.session.user = {
            id: user.id,
            name: user.full_name,
            email: user.email,
            role: user.role,
            status: user.status
          };

          logAudit({
            userEmail: email,
            action: "Login",
            status: "success",
            ipAddress
          });

          return res.json({
            message: "Login successful",
            user: req.session.user
          });
        });
      }
    );
  }
);

router.post("/logout", requireAuth, (req, res) => {
  const email = req.session.user.email;
  const ipAddress = req.ip;

  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({
        message: "Could not log out"
      });
    }

    logAudit({
      userEmail: email,
      action: "Logout",
      status: "success",
      ipAddress
    });

    res.clearCookie("connect.sid");
    return res.json({
      message: "Logout successful"
    });
  });
});

router.get("/me", requireAuth, (req, res) => {
  return res.json({
    user: req.session.user
  });
});

router.post(
  "/change-password",
  requireAuth,
  [
    body("oldPassword")
      .notEmpty()
      .withMessage("Old password is required"),
    body("newPassword")
      .isLength({ min: 12 })
      .withMessage("New password must be at least 12 characters")
      .matches(/[A-Z]/)
      .withMessage("New password must contain at least one uppercase letter")
      .matches(/[a-z]/)
      .withMessage("New password must contain at least one lowercase letter")
      .matches(/[0-9]/)
      .withMessage("New password must contain at least one number")
      .matches(/[^A-Za-z0-9]/)
      .withMessage("New password must contain at least one symbol")
  ],
  (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: "Validation failed",
        errors: errors.array()
      });
    }

    const userEmail = req.session.user.email;
    const ipAddress = req.ip;
    const { oldPassword, newPassword } = req.body;

    db.get("SELECT * FROM users WHERE email = ?", [userEmail], async (err, user) => {
      if (err) {
        console.error("Change password lookup error:", err.message);
        return res.status(500).json({
          message: "Server error"
        });
      }

      if (!user) {
        return res.status(404).json({
          message: "User not found"
        });
      }

      const match = await bcrypt.compare(oldPassword, user.password_hash);

      if (!match) {
        logAudit({
          userEmail,
          action: "Password change",
          status: "failed",
          ipAddress
        });

        return res.status(401).json({
          message: "Old password is incorrect"
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);

      db.run(
        "UPDATE users SET password_hash = ? WHERE email = ?",
        [hashedPassword, userEmail],
        function (updateErr) {
          if (updateErr) {
            console.error("Change password update error:", updateErr.message);
            return res.status(500).json({
              message: "Could not update password"
            });
          }

          logAudit({
            userEmail,
            action: "Password change",
            status: "success",
            ipAddress
          });

          return res.json({
            message: "Password changed successfully"
          });
        }
      );
    });
  }
);

module.exports = router;