const db = require("../db/database");

function logAudit({ userEmail, action, status, ipAddress }) {
  db.run(
    `INSERT INTO audit_logs (user_email, action, status, ip_address)
     VALUES (?, ?, ?, ?)`,
    [userEmail || null, action, status, ipAddress || null],
    (err) => {
      if (err) {
        console.error("Audit log error:", err.message);
      }
    }
  );
}

module.exports = {
  logAudit
};