require("dotenv").config();

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is missing from environment variables.");
}

const express = require("express");
const session = require("express-session");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

require("./db/database");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const gradeRoutes = require("./routes/gradeRoutes");
const logRoutes = require("./routes/logRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");

const app = express();

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true
  })
);

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60
    }
  })
);

app.get("/", (req, res) => {
  res.send("Secure Software Backend Running");
});

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/grades", gradeRoutes);
app.use("/logs", logRoutes);
app.use("/feedback", feedbackRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: "Route not found"
  });
});

app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({
    message: "Internal server error"
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});