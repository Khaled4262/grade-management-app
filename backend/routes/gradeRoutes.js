const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const csv = require("csv-parser");
const { body, validationResult } = require("express-validator");
const db = require("../db/database");
const { requireAuth, requireTeacherOrAdmin } = require("../middleware/authMiddleware");
const { logAudit } = require("../utils/audit");

const router = express.Router();

const allowedMimeTypes = ["text/csv", "application/vnd.ms-excel"];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "..", "uploads"));
  },
  filename: (req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (extension !== ".csv") {
      return cb(new Error("Only .csv files are allowed"));
    }

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error("Invalid file type"));
    }

    cb(null, true);
  }
});

router.get("/", requireAuth, (req, res) => {
  const currentUser = req.session.user;

  if (currentUser.role === "admin" || currentUser.role === "teacher") {
    db.all(
      `SELECT
         g.id,
         s.full_name AS student,
         g.course,
         g.assignment,
         g.grade,
         u.full_name AS uploadedBy,
         date(g.created_at) AS date
       FROM grades g
       JOIN users s ON g.student_id = s.id
       JOIN users u ON g.uploaded_by = u.id
       ORDER BY g.created_at DESC`,
      [],
      (err, rows) => {
        if (err) {
          console.error("Fetch grades error:", err.message);
          return res.status(500).json({
            message: "Could not fetch grades"
          });
        }

        return res.json({
          grades: rows
        });
      }
    );
    return;
  }

  if (currentUser.role === "student") {
    db.all(
      `SELECT
         id,
         course,
         assignment,
         grade,
         date(created_at) AS date
       FROM grades
       WHERE student_id = ?
       ORDER BY created_at DESC`,
      [currentUser.id],
      (err, rows) => {
        if (err) {
          console.error("Fetch student grades error:", err.message);
          return res.status(500).json({
            message: "Could not fetch grades"
          });
        }

        return res.json({
          grades: rows
        });
      }
    );
    return;
  }

  return res.status(403).json({
    message: "Access denied"
  });
});

router.post(
  "/create",
  requireTeacherOrAdmin,
  [
    body("student_id").isInt().withMessage("student_id must be an integer"),
    body("course").trim().notEmpty().withMessage("Course is required"),
    body("assignment").trim().notEmpty().withMessage("Assignment is required"),
    body("grade").isInt({ min: 0, max: 100 }).withMessage("Grade must be between 0 and 100")
  ],
  (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: "Validation failed",
        errors: errors.array()
      });
    }

    const uploadedBy = req.session.user.id;
    const { student_id, course, assignment, grade } = req.body;

    db.run(
      `INSERT INTO grades (student_id, course, assignment, grade, uploaded_by)
       VALUES (?, ?, ?, ?, ?)`,
      [student_id, course, assignment, grade, uploadedBy],
      function (err) {
        if (err) {
          console.error("Create grade error:", err.message);
          return res.status(500).json({
            message: "Could not create grade"
          });
        }

        logAudit({
          userEmail: req.session.user.email,
          action: "Grade create",
          status: "success",
          ipAddress: req.ip
        });

        return res.status(201).json({
          message: "Grade created successfully",
          gradeId: this.lastID
        });
      }
    );
  }
);

router.post("/upload", requireTeacherOrAdmin, (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        message: err.message || "File upload failed"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "CSV file is required"
      });
    }

    const uploadedBy = req.session.user.id;
    const filePath = req.file.path;
    const rows = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        rows.push(row);
      })
      .on("end", () => {
        if (rows.length === 0) {
          return res.status(400).json({
            message: "CSV file is empty"
          });
        }

        const validRows = rows.filter((row) => {
          const studentId = Number(row.student_id);
          const grade = Number(row.grade);

          return (
            Number.isInteger(studentId) &&
            row.course &&
            row.assignment &&
            Number.isInteger(grade) &&
            grade >= 0 &&
            grade <= 100
          );
        });

        if (validRows.length === 0) {
          return res.status(400).json({
            message: "No valid grade rows found in CSV"
          });
        }

        db.run(
          `INSERT INTO grade_uploads (uploaded_by, original_filename, stored_filename)
           VALUES (?, ?, ?)`,
          [uploadedBy, req.file.originalname, req.file.filename],
          (uploadErr) => {
            if (uploadErr) {
              console.error("Save upload record error:", uploadErr.message);
              return res.status(500).json({
                message: "Could not save upload record"
              });
            }

            let completed = 0;
            let inserted = 0;
            let failed = 0;
            let responseSent = false;

            validRows.forEach((row) => {
              db.run(
                `INSERT INTO grades (student_id, course, assignment, grade, uploaded_by)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                  Number(row.student_id),
                  row.course.trim(),
                  row.assignment.trim(),
                  Number(row.grade),
                  uploadedBy
                ],
                (insertErr) => {
                  completed++;

                  if (insertErr) {
                    failed++;
                    console.error("Insert grade row error:", insertErr.message);
                  } else {
                    inserted++;
                  }

                  if (completed === validRows.length && !responseSent) {
                    responseSent = true;

                    logAudit({
                      userEmail: req.session.user.email,
                      action: "CSV grade upload",
                      status: "success",
                      ipAddress: req.ip
                    });

                    return res.status(201).json({
                      message: `CSV uploaded successfully. ${inserted} grade(s) imported.`,
                      inserted,
                      failed
                    });
                  }
                }
              );
            });
          }
        );
      })
      .on("error", (parseErr) => {
        console.error("CSV parse error:", parseErr.message);
        return res.status(500).json({
          message: "Could not process CSV file"
        });
      });
  });
});

module.exports = router;