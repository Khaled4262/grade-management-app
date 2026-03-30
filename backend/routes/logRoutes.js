const express = require("express");
const db = require("../db/database");
const { requireAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", requireAdmin, (req, res) => {
  db.all(
    `SELECT
       datetime(created_at) AS time,
       user_email AS user,
       action,
       ip_address AS ip,
       status
     FROM audit_logs
     ORDER BY created_at DESC
     LIMIT 100`,
    [],
    (err, rows) => {
      if (err) {
        console.error("Fetch logs error:", err.message);
        return res.status(500).json({
          message: "Could not fetch logs"
        });
      }

      return res.json({
        logs: rows
      });
    }
  );
});

module.exports = router;