const express = require("express");
const { body, validationResult } = require("express-validator");
const db = require("../db/database");
const { requireAuth } = require("../middleware/authMiddleware");
const { logAudit } = require("../utils/audit");

const router = express.Router();

router.post(
  "/",
  requireAuth,
  [
    body("message")
      .trim()
      .notEmpty()
      .withMessage("Feedback message is required")
      .isLength({ max: 1000 })
      .withMessage("Feedback must be 1000 characters or less")
  ],
  (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: "Validation failed",
        errors: errors.array()
      });
    }

    db.run(
      `INSERT INTO feedback (user_id, message)
       VALUES (?, ?)`,
      [req.session.user.id, req.body.message.trim()],
      function (err) {
        if (err) {
          console.error("Create feedback error:", err.message);
          return res.status(500).json({
            message: "Could not submit feedback"
          });
        }

        logAudit({
          userEmail: req.session.user.email,
          action: "Feedback submission",
          status: "success",
          ipAddress: req.ip
        });

        return res.status(201).json({
          message: "Feedback submitted successfully",
          feedbackId: this.lastID
        });
      }
    );
  }
);

module.exports = router;