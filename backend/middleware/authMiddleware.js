function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      message: "Authentication required"
    });
  }

  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      message: "Authentication required"
    });
  }

  if (req.session.user.role !== "admin") {
    return res.status(403).json({
      message: "Admin access required"
    });
  }

  next();
}

function requireTeacherOrAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      message: "Authentication required"
    });
  }

  const role = req.session.user.role;

  if (role !== "teacher" && role !== "admin") {
    return res.status(403).json({
      message: "Teacher or admin access required"
    });
  }

  next();
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireTeacherOrAdmin
};