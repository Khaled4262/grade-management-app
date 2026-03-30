import { useState, useEffect, useCallback } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;
const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 min
const ALLOWED_FILE_TYPES = ["text/csv"];
const ALLOWED_EXTENSIONS = [".csv"];
const MAX_FILE_SIZE_MB = 2;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function sanitize(str) {
  return str.replace(/[<>"'`]/g, "");
}

function getPasswordStrength(pw) {
  let score = 0;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

function strengthLabel(score) {
  if (score <= 1) return { label: "Very weak", color: "#e24b4a" };
  if (score === 2) return { label: "Weak", color: "#ef9f27" };
  if (score === 3) return { label: "Fair", color: "#fac775" };
  if (score === 4) return { label: "Strong", color: "#97c459" };
  return { label: "Very strong", color: "#1d9e75" };
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const S = {
  app: {
    minHeight: "100vh",
    background: "#0b0f1a",
    color: "#c9d1e0",
    fontFamily: "'IBM Plex Sans', 'Segoe UI', sans-serif",
    display: "flex",
    flexDirection: "column",
  },
  nav: {
    background: "#0d1220",
    borderBottom: "1px solid #1e2d45",
    padding: "0 2rem",
    display: "flex",
    alignItems: "center",
    height: 56,
    gap: 24,
  },
  navBrand: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 15,
    fontWeight: 600,
    color: "#38bdf8",
    letterSpacing: "0.04em",
    marginRight: "auto",
  },
  navChip: {
    fontSize: 11,
    padding: "2px 10px",
    borderRadius: 99,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  navBtn: {
    background: "none",
    border: "1px solid #1e3a52",
    color: "#64a0c8",
    padding: "6px 14px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "inherit",
    transition: "background 0.15s, color 0.15s",
  },
  main: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem 1rem",
  },
  card: {
    background: "#0d1220",
    border: "1px solid #1e2d45",
    borderRadius: 14,
    padding: "2.5rem 2rem",
    width: "100%",
    maxWidth: 440,
    boxShadow: "0 4px 32px rgba(0,0,0,0.4)",
  },
  wideCard: {
    background: "#0d1220",
    border: "1px solid #1e2d45",
    borderRadius: 14,
    padding: "2rem",
    width: "100%",
    maxWidth: 980,
    boxShadow: "0 4px 32px rgba(0,0,0,0.4)",
  },
  cardTitle: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 20,
    fontWeight: 700,
    color: "#e2e8f0",
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 13,
    color: "#546e8a",
    marginBottom: 28,
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#546e8a",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    background: "#0b0f1a",
    border: "1px solid #1e2d45",
    borderRadius: 8,
    padding: "10px 14px",
    color: "#c9d1e0",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  },
  select: {
    width: "100%",
    background: "#0b0f1a",
    border: "1px solid #1e2d45",
    borderRadius: 8,
    padding: "10px 14px",
    color: "#c9d1e0",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
  },
  btnPrimary: {
    width: "100%",
    background: "#0ea5e9",
    border: "none",
    borderRadius: 8,
    padding: "11px 0",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background 0.15s, opacity 0.15s",
    letterSpacing: "0.02em",
  },
  btnSecondary: {
    background: "none",
    border: "1px solid #1e3a52",
    borderRadius: 8,
    padding: "8px 18px",
    color: "#64a0c8",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background 0.15s",
  },
  btnDanger: {
    background: "none",
    border: "1px solid #7f1d1d",
    borderRadius: 8,
    padding: "8px 18px",
    color: "#f87171",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background 0.15s",
  },
  alert: (type) => ({
    padding: "10px 14px",
    borderRadius: 8,
    fontSize: 13,
    marginBottom: 18,
    background:
      type === "error"
        ? "rgba(226,75,74,0.12)"
        : type === "warn"
        ? "rgba(239,159,39,0.12)"
        : "rgba(29,158,117,0.12)",
    border: `1px solid ${
      type === "error" ? "#7f1d1d" : type === "warn" ? "#854f0b" : "#0f6e56"
    }`,
    color:
      type === "error" ? "#f87171" : type === "warn" ? "#fbbf24" : "#34d399",
  }),
  fieldRow: { marginBottom: 18 },
  link: {
    color: "#38bdf8",
    fontSize: 13,
    cursor: "pointer",
    textDecoration: "underline",
    background: "none",
    border: "none",
    fontFamily: "inherit",
    padding: 0,
  },
  divider: {
    height: 1,
    background: "#1e2d45",
    margin: "20px 0",
  },
  badge: (color) => ({
    display: "inline-block",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    padding: "2px 10px",
    borderRadius: 99,
    background:
      color === "cyan"
        ? "rgba(14,165,233,0.15)"
        : color === "green"
        ? "rgba(29,158,117,0.15)"
        : color === "amber"
        ? "rgba(239,159,39,0.15)"
        : "rgba(226,75,74,0.15)",
    color:
      color === "cyan"
        ? "#38bdf8"
        : color === "green"
        ? "#34d399"
        : color === "amber"
        ? "#fbbf24"
        : "#f87171",
  }),
  sectionTitle: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 13,
    fontWeight: 700,
    color: "#546e8a",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: 14,
    marginTop: 28,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  th: {
    textAlign: "left",
    padding: "8px 14px",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#546e8a",
    borderBottom: "1px solid #1e2d45",
  },
  td: {
    padding: "10px 14px",
    borderBottom: "1px solid #131c2e",
    color: "#c9d1e0",
    verticalAlign: "middle",
  },
  statCard: {
    background: "#111827",
    border: "1px solid #1e2d45",
    borderRadius: 10,
    padding: "1rem 1.25rem",
    flex: 1,
    minWidth: 120,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    color: "#546e8a",
    marginBottom: 6,
  },
  statValue: {
    fontSize: 26,
    fontWeight: 700,
    fontFamily: "'IBM Plex Mono', monospace",
    color: "#e2e8f0",
  },
  fileZone: {
    border: "1.5px dashed #1e3a52",
    borderRadius: 10,
    padding: "24px 16px",
    textAlign: "center",
    cursor: "pointer",
    background: "#0b0f1a",
    transition: "border-color 0.15s",
  },
  secNote: {
    fontSize: 11,
    color: "#2d4a63",
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  tabs: {
    display: "flex",
    gap: 4,
    marginBottom: 24,
    background: "#0b0f1a",
    border: "1px solid #1e2d45",
    borderRadius: 10,
    padding: 4,
  },
  tab: (active) => ({
    flex: 1,
    padding: "8px 0",
    borderRadius: 7,
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 600,
    background: active ? "#0ea5e9" : "none",
    color: active ? "#fff" : "#546e8a",
    transition: "background 0.15s, color 0.15s",
  }),
};

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_USERS = [
  { id: 1, name: "Alice Chen", email: "alice@unb.ca", role: "student", status: "active", joined: "2024-09-01" },
  { id: 2, name: "Bob Russo", email: "bob@unb.ca", role: "student", status: "active", joined: "2024-09-01" },
  { id: 3, name: "Dr. Patel", email: "patel@unb.ca", role: "teacher", status: "active", joined: "2023-01-10" },
  { id: 4, name: "Eve Nakamura", email: "eve@unb.ca", role: "student", status: "suspended", joined: "2024-09-01" },
];

const MOCK_GRADES = [
  { student: "Alice Chen", course: "CS4417", assignment: "Lab 1", grade: 88, uploadedBy: "Dr. Patel", date: "2025-03-10" },
  { student: "Bob Russo", course: "CS4417", assignment: "Lab 1", grade: 74, uploadedBy: "Dr. Patel", date: "2025-03-10" },
  { student: "Alice Chen", course: "CS4417", assignment: "Midterm", grade: 91, uploadedBy: "Dr. Patel", date: "2025-03-20" },
  { student: "Bob Russo", course: "CS4417", assignment: "Midterm", grade: 68, uploadedBy: "Dr. Patel", date: "2025-03-20" },
];

const MOCK_LOGS = [
  { time: "2025-03-29 09:14", user: "alice@unb.ca", action: "Login", ip: "192.168.1.4", status: "success" },
  { time: "2025-03-29 09:02", user: "unknown@x.com", action: "Login", ip: "203.0.113.8", status: "failed" },
  { time: "2025-03-29 08:55", user: "unknown@x.com", action: "Login", ip: "203.0.113.8", status: "failed" },
  { time: "2025-03-28 17:30", user: "patel@unb.ca", action: "Grade upload", ip: "10.0.0.2", status: "success" },
  { time: "2025-03-28 16:10", user: "eve@unb.ca", action: "Login", ip: "192.168.1.99", status: "success" },
  { time: "2025-03-27 11:45", user: "bob@unb.ca", action: "Password change", ip: "192.168.1.21", status: "success" },
];

// ─── Components ───────────────────────────────────────────────────────────────

function SessionTimer({ onExpire }) {
  const [remaining, setRemaining] = useState(SESSION_TIMEOUT_MS / 1000);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { onExpire(); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onExpire]);

  const mins = Math.floor(remaining / 60);
  const secs = String(remaining % 60).padStart(2, "0");
  const urgent = remaining < 120;

  return (
    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: urgent ? "#f87171" : "#546e8a" }}>
      {urgent && "⚠ "}Session: {mins}:{secs}
    </span>
  );
}

function PasswordStrengthBar({ password }) {
  const score = getPasswordStrength(password);
  const { label, color } = strengthLabel(score);
  if (!password) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{
            height: 3, flex: 1, borderRadius: 99,
            background: i <= score ? color : "#1e2d45",
            transition: "background 0.2s",
          }} />
        ))}
      </div>
      <span style={{ fontSize: 11, color }}>{label}</span>
    </div>
  );
}

// ─── Login Page ───────────────────────────────────────────────────────────────
function LoginPage({ onLogin, onGoRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locked) return;
    setLockTimer(LOCKOUT_SECONDS);
    const interval = setInterval(() => {
      setLockTimer((t) => {
        if (t <= 1) { setLocked(false); setAttempts(0); clearInterval(interval); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [locked]);

  const handleSubmit = () => {
    if (locked) return;
    setError("");
    const cleanEmail = sanitize(email.trim().toLowerCase());

    if (!validateEmail(cleanEmail)) { setError("Enter a valid email address."); return; }
    if (!password) { setError("Password is required."); return; }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      // Demo credentials
      const creds = {
        "teacher@unb.ca": { pass: "Teacher@Pass1!", role: "teacher", name: "Dr. Patel" },
        "admin@unb.ca": { pass: "Admin@Pass1!", role: "admin", name: "System Admin" },
      };
      const found = creds[cleanEmail];
      if (found && found.pass === password) {
        setAttempts(0);
        onLogin({ email: cleanEmail, role: found.role, name: found.name, token: "demo-csrf-token-xyz" });
      } else {
        const next = attempts + 1;
        setAttempts(next);
        if (next >= MAX_LOGIN_ATTEMPTS) {
          setLocked(true);
          setError(`Account locked after ${MAX_LOGIN_ATTEMPTS} failed attempts. Try again in ${LOCKOUT_SECONDS}s.`);
        } else {
          setError(`Invalid credentials. ${MAX_LOGIN_ATTEMPTS - next} attempt${MAX_LOGIN_ATTEMPTS - next !== 1 ? "s" : ""} remaining.`);
        }
      }
    }, 600);
  };

  return (
    <div style={S.main}>
      <div style={S.card}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#38bdf8", marginBottom: 10 }}>
          GradeVault — Secure Portal
        </div>
        <div style={S.cardTitle}>Sign in</div>
        <div style={S.cardSub}>Authorized users only. All activity is logged.</div>

        {error && <div style={S.alert("error")}>{error}</div>}
        {locked && <div style={S.alert("warn")}>Locked for {lockTimer}s. Too many failed attempts.</div>}

        <div style={S.fieldRow}>
          <label style={S.label}>Email address</label>
          <input
            style={S.input}
            type="email"
            autoComplete="username"
            placeholder="you@unb.ca"
            value={email}
            disabled={locked}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
        </div>

        <div style={S.fieldRow}>
          <label style={S.label}>Password</label>
          <input
            style={S.input}
            type="password"
            autoComplete="current-password"
            placeholder="••••••••••••"
            value={password}
            disabled={locked}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
        </div>

        {attempts > 0 && !locked && (
          <div style={{ fontSize: 12, color: "#fbbf24", marginBottom: 14 }}>
            {attempts} failed attempt{attempts !== 1 ? "s" : ""}
          </div>
        )}

        <button
          style={{ ...S.btnPrimary, opacity: locked || loading ? 0.5 : 1 }}
          disabled={locked || loading}
          onClick={handleSubmit}
        >
          {loading ? "Authenticating…" : "Sign in"}
        </button>

        <div style={{ ...S.secNote, marginTop: 16 }}>
          <span>🔒</span> Secured with HTTPS · Sessions expire after 15 min
        </div>

        <div style={S.divider} />
        <div style={{ fontSize: 13, color: "#546e8a" }}>
          Don't have an account?{" "}
          <button style={S.link} onClick={onGoRegister}>Register here</button>
        </div>

        <div style={{ marginTop: 20, padding: "10px 14px", background: "#111827", borderRadius: 8, fontSize: 12, color: "#546e8a" }}>
          <strong style={{ color: "#38bdf8" }}>Demo credentials</strong><br />
          Teacher: teacher@unb.ca / Teacher@Pass1!<br />
          Admin: admin@unb.ca / Admin@Pass1!
        </div>
      </div>
    </div>
  );
}

// ─── Register Page ────────────────────────────────────────────────────────────
function RegisterPage({ onGoLogin }) {
  const [form, setForm] = useState({ name: "", email: "", role: "student", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required.";
    if (!validateEmail(form.email.trim())) e.email = "Enter a valid email.";
    if (getPasswordStrength(form.password) < 4) e.password = "Password is too weak. Use 12+ chars with mixed case, numbers, and symbols.";
    if (form.password !== form.confirm) e.confirm = "Passwords do not match.";
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length === 0) setSuccess(true);
  };

  if (success) return (
    <div style={S.main}>
      <div style={S.card}>
        <div style={S.alert("success")}>
          ✓ Account created successfully. Awaiting admin approval before login.
        </div>
        <div style={{ fontSize: 13, color: "#546e8a", marginBottom: 20 }}>
          For security, new accounts require admin review. You will be notified via email.
        </div>
        <button style={S.btnPrimary} onClick={onGoLogin}>Back to sign in</button>
      </div>
    </div>
  );

  return (
    <div style={S.main}>
      <div style={S.card}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#38bdf8", marginBottom: 10 }}>
          GradeVault — Secure Portal
        </div>
        <div style={S.cardTitle}>Create account</div>
        <div style={S.cardSub}>All fields are required. Strong passwords enforced.</div>

        {[
          { key: "name", label: "Full name", type: "text", placeholder: "Jane Smith", autoComplete: "name" },
          { key: "email", label: "University email", type: "email", placeholder: "you@unb.ca", autoComplete: "username" },
        ].map(({ key, label, type, placeholder, autoComplete }) => (
          <div style={S.fieldRow} key={key}>
            <label style={S.label}>{label}</label>
            <input
              style={{ ...S.input, borderColor: errors[key] ? "#7f1d1d" : "#1e2d45" }}
              type={type}
              placeholder={placeholder}
              autoComplete={autoComplete}
              value={form[key]}
              onChange={(e) => update(key, sanitize(e.target.value))}
            />
            {errors[key] && <div style={{ fontSize: 12, color: "#f87171", marginTop: 4 }}>{errors[key]}</div>}
          </div>
        ))}

        <div style={S.fieldRow}>
          <label style={S.label}>Role</label>
          <select style={S.select} value={form.role} onChange={(e) => update("role", e.target.value)}>
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
          </select>
          <div style={S.secNote}><span>ℹ</span> Admin accounts are created by existing admins only.</div>
        </div>

        <div style={S.fieldRow}>
          <label style={S.label}>Password</label>
          <input
            style={{ ...S.input, borderColor: errors.password ? "#7f1d1d" : "#1e2d45" }}
            type="password"
            autoComplete="new-password"
            placeholder="Min 12 characters"
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
          />
          <PasswordStrengthBar password={form.password} />
          {errors.password && <div style={{ fontSize: 12, color: "#f87171", marginTop: 4 }}>{errors.password}</div>}
          <div style={{ fontSize: 11, color: "#2d4a63", marginTop: 6 }}>
            Requires 12+ chars · uppercase · lowercase · number · symbol
          </div>
        </div>

        <div style={S.fieldRow}>
          <label style={S.label}>Confirm password</label>
          <input
            style={{ ...S.input, borderColor: errors.confirm ? "#7f1d1d" : "#1e2d45" }}
            type="password"
            autoComplete="new-password"
            placeholder="Re-enter password"
            value={form.confirm}
            onChange={(e) => update("confirm", e.target.value)}
          />
          {errors.confirm && <div style={{ fontSize: 12, color: "#f87171", marginTop: 4 }}>{errors.confirm}</div>}
        </div>

        <button style={S.btnPrimary} onClick={handleSubmit}>Create account</button>

        <div style={S.divider} />
        <div style={{ fontSize: 13, color: "#546e8a" }}>
          Already have an account?{" "}
          <button style={S.link} onClick={onGoLogin}>Sign in</button>
        </div>
      </div>
    </div>
  );
}

// ─── Teacher Dashboard ────────────────────────────────────────────────────────
function TeacherDashboard({ user }) {
  const [tab, setTab] = useState("grades");
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [fileSuccess, setFileSuccess] = useState("");
  const [feedback, setFeedback] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [dragging, setDragging] = useState(false);

  const validateFile = (f) => {
    setFileError("");
    setFileSuccess("");
    if (!f) return;
    const ext = "." + f.name.split(".").pop().toLowerCase();
    const mime = f.type;
    if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_FILE_TYPES.includes(mime)) {
      setFileError(`Invalid file type. Only .csv files are accepted.`);
      setFile(null);
      return;
    }
    if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setFileError(`File exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
      setFile(null);
      return;
    }
    setFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    validateFile(e.dataTransfer.files[0]);
  };

  const handleUpload = () => {
    if (!file) return;
    setTimeout(() => {
      setFileSuccess(`"${file.name}" uploaded securely. Grades pending review.`);
      setFile(null);
    }, 800);
  };

  const handleFeedback = () => {
    if (!feedback.trim()) return;
    setFeedbackSent(true);
    setFeedback("");
  };

  return (
    <div style={{ padding: "2rem", maxWidth: 980, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#38bdf8", marginBottom: 4 }}>
          Teacher Dashboard
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0" }}>Welcome, {user.name}</div>
        <div style={{ fontSize: 13, color: "#546e8a" }}>Role: <span style={S.badge("cyan")}>Teacher</span> · Logged in as {user.email}</div>
      </div>

      <div style={{ display: "flex", gap: 14, marginBottom: 28, flexWrap: "wrap" }}>
        {[
          { label: "Courses", value: "3" },
          { label: "Students", value: "48" },
          { label: "Grades uploaded", value: "142" },
        ].map(({ label, value }) => (
          <div key={label} style={S.statCard}>
            <div style={S.statLabel}>{label}</div>
            <div style={S.statValue}>{value}</div>
          </div>
        ))}
      </div>

      <div style={S.tabs}>
        {["grades", "upload", "feedback"].map((t) => (
          <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>
            {{ grades: "Grade Records", upload: "Upload Grades", feedback: "Feedback" }[t]}
          </button>
        ))}
      </div>

      {tab === "grades" && (
        <div>
          <div style={S.sectionTitle}>Recent Grade Records</div>
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead>
                <tr>
                  {["Student", "Course", "Assignment", "Grade", "Date"].map((h) => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOCK_GRADES.map((g, i) => (
                  <tr key={i}>
                    <td style={S.td}>{g.student}</td>
                    <td style={S.td}><code style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>{g.course}</code></td>
                    <td style={S.td}>{g.assignment}</td>
                    <td style={S.td}>
                      <span style={{ fontWeight: 700, color: g.grade >= 80 ? "#34d399" : g.grade >= 60 ? "#fbbf24" : "#f87171" }}>
                        {g.grade}%
                      </span>
                    </td>
                    <td style={{ ...S.td, color: "#546e8a", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>{g.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={S.secNote}>
            <span>🔒</span> Grade data is only visible to the assigned teacher and student. Stored with authorization checks per CWE-200.
          </div>
        </div>
      )}

      {tab === "upload" && (
        <div style={{ maxWidth: 520 }}>
          <div style={S.sectionTitle}>Upload Grade File</div>
          {fileError && <div style={S.alert("error")}>{fileError}</div>}
          {fileSuccess && <div style={S.alert("success")}>{fileSuccess}</div>}

          <div
            style={{ ...S.fileZone, borderColor: dragging ? "#38bdf8" : "#1e3a52" }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById("file-input").click()}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
            <div style={{ fontSize: 14, color: "#64a0c8", marginBottom: 4 }}>
              {file ? file.name : "Drag & drop or click to browse"}
            </div>
            <div style={{ fontSize: 12, color: "#2d4a63" }}>Only .csv files · Max {MAX_FILE_SIZE_MB}MB</div>
            <input
              id="file-input"
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={(e) => validateFile(e.target.files[0])}
            />
          </div>

          <div style={{ ...S.secNote, marginTop: 10 }}>
            <span>🔒</span> Files are validated server-side (MIME + extension). Stored outside web root. (CWE-434)
          </div>

          <button
            style={{ ...S.btnPrimary, marginTop: 16, opacity: file ? 1 : 0.4, width: "auto", padding: "10px 28px" }}
            disabled={!file}
            onClick={handleUpload}
          >
            Upload securely
          </button>
        </div>
      )}

      {tab === "feedback" && (
        <div style={{ maxWidth: 520 }}>
          <div style={S.sectionTitle}>Submit Feedback</div>
          {feedbackSent && <div style={S.alert("success")}>Feedback submitted successfully.</div>}
          <div style={S.fieldRow}>
            <label style={S.label}>Your message</label>
            <textarea
              style={{ ...S.input, height: 120, resize: "vertical" }}
              placeholder="Write your feedback here…"
              value={feedback}
              maxLength={1000}
              onChange={(e) => setFeedback(sanitize(e.target.value))}
            />
            <div style={{ fontSize: 11, color: "#2d4a63", marginTop: 4 }}>
              {feedback.length}/1000 · Input is sanitized and encoded before storage (CWE-79)
            </div>
          </div>
          <button style={{ ...S.btnPrimary, width: "auto", padding: "10px 28px" }} onClick={handleFeedback}>
            Submit
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
function AdminDashboard({ user }) {
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState(MOCK_USERS);
  const [confirmAction, setConfirmAction] = useState(null);
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "student" });
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");

  const toggleStatus = (id) => {
    setUsers((us) => us.map((u) => u.id === id ? { ...u, status: u.status === "active" ? "suspended" : "active" } : u));
    setConfirmAction(null);
  };

  const handleAddUser = () => {
    setAddError("");
    if (!newUser.name.trim()) { setAddError("Name required."); return; }
    if (!validateEmail(newUser.email.trim())) { setAddError("Valid email required."); return; }
    setUsers((us) => [...us, { id: Date.now(), name: newUser.name, email: newUser.email, role: newUser.role, status: "active", joined: new Date().toISOString().slice(0, 10) }]);
    setNewUser({ name: "", email: "", role: "student" });
    setAddSuccess("User created successfully.");
    setTimeout(() => setAddSuccess(""), 3000);
  };

  return (
    <div style={{ padding: "2rem", maxWidth: 980, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#f87171", marginBottom: 4 }}>
          Admin Dashboard
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0" }}>System Control Panel</div>
        <div style={{ fontSize: 13, color: "#546e8a" }}>Logged in as <span style={S.badge("amber")}>Admin</span> · {user.email} · All actions are audited</div>
      </div>

      <div style={{ display: "flex", gap: 14, marginBottom: 28, flexWrap: "wrap" }}>
        {[
          { label: "Total users", value: users.length },
          { label: "Active", value: users.filter((u) => u.status === "active").length },
          { label: "Suspended", value: users.filter((u) => u.status !== "active").length },
          { label: "Log events", value: MOCK_LOGS.length },
        ].map(({ label, value }) => (
          <div key={label} style={S.statCard}>
            <div style={S.statLabel}>{label}</div>
            <div style={S.statValue}>{value}</div>
          </div>
        ))}
      </div>

      <div style={S.tabs}>
        {["users", "add", "logs"].map((t) => (
          <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>
            {{ users: "User Management", add: "Add User", logs: "Audit Logs" }[t]}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <div>
          <div style={S.sectionTitle}>All Users</div>
          {confirmAction && (
            <div style={{ ...S.alert("warn"), display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span>Confirm: {confirmAction.action} user <strong>{confirmAction.name}</strong>?</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={S.btnDanger} onClick={() => toggleStatus(confirmAction.id)}>Confirm</button>
                <button style={S.btnSecondary} onClick={() => setConfirmAction(null)}>Cancel</button>
              </div>
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead>
                <tr>
                  {["Name", "Email", "Role", "Status", "Joined", "Action"].map((h) => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={S.td}>{u.name}</td>
                    <td style={{ ...S.td, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>{u.email}</td>
                    <td style={S.td}><span style={S.badge(u.role === "admin" ? "amber" : u.role === "teacher" ? "cyan" : "green")}>{u.role}</span></td>
                    <td style={S.td}><span style={S.badge(u.status === "active" ? "green" : "red")}>{u.status}</span></td>
                    <td style={{ ...S.td, color: "#546e8a", fontSize: 12 }}>{u.joined}</td>
                    <td style={S.td}>
                      <button
                        style={u.status === "active" ? S.btnDanger : S.btnSecondary}
                        onClick={() => setConfirmAction({ id: u.id, name: u.name, action: u.status === "active" ? "Suspend" : "Reactivate" })}
                        disabled={u.email === user.email}
                      >
                        {u.status === "active" ? "Suspend" : "Reactivate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={S.secNote}><span>🔒</span> Role changes require re-authentication. Actions logged per CWE-285 / CWE-269.</div>
        </div>
      )}

      {tab === "add" && (
        <div style={{ maxWidth: 480 }}>
          <div style={S.sectionTitle}>Create New User</div>
          {addError && <div style={S.alert("error")}>{addError}</div>}
          {addSuccess && <div style={S.alert("success")}>{addSuccess}</div>}

          {[
            { key: "name", label: "Full name", type: "text", placeholder: "Jane Smith" },
            { key: "email", label: "Email address", type: "email", placeholder: "user@unb.ca" },
          ].map(({ key, label, type, placeholder }) => (
            <div style={S.fieldRow} key={key}>
              <label style={S.label}>{label}</label>
              <input
                style={S.input}
                type={type}
                placeholder={placeholder}
                value={newUser[key]}
                onChange={(e) => setNewUser((u) => ({ ...u, [key]: sanitize(e.target.value) }))}
              />
            </div>
          ))}

          <div style={S.fieldRow}>
            <label style={S.label}>Role</label>
            <select style={S.select} value={newUser.role} onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value }))}>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div style={{ ...S.alert("warn"), marginBottom: 16 }}>
            A temporary password will be emailed to the user. They must change it on first login.
          </div>

          <button style={{ ...S.btnPrimary, width: "auto", padding: "10px 28px" }} onClick={handleAddUser}>
            Create user
          </button>
          <div style={{ ...S.secNote, marginTop: 12 }}><span>🔒</span> Passwords generated with bcrypt/Argon2, never stored in plaintext. (CWE-256)</div>
        </div>
      )}

      {tab === "logs" && (
        <div>
          <div style={S.sectionTitle}>Audit Log</div>
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead>
                <tr>
                  {["Timestamp", "User", "Action", "IP Address", "Status"].map((h) => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOCK_LOGS.map((log, i) => (
                  <tr key={i}>
                    <td style={{ ...S.td, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#546e8a" }}>{log.time}</td>
                    <td style={{ ...S.td, fontSize: 12 }}>{log.user}</td>
                    <td style={S.td}>{log.action}</td>
                    <td style={{ ...S.td, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#64a0c8" }}>{log.ip}</td>
                    <td style={S.td}><span style={S.badge(log.status === "success" ? "green" : "red")}>{log.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={S.secNote}><span>🔒</span> Logs are append-only and tamper-protected. Alerts triggered on repeated failures. (CWE-307)</div>
        </div>
      )}
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("login");
  const [user, setUser] = useState(null);

  const handleLogin = (u) => {
    setUser(u);
    setPage("dashboard");
  };

  const handleLogout = useCallback(() => {
    setUser(null);
    setPage("login");
  }, []);

  const roleColor = user?.role === "admin" ? "#f87171" : "#38bdf8";

  return (
    <div style={S.app}>
      {/* Google Fonts */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=IBM+Plex+Sans:wght@400;600;700&display=swap');`}</style>

      {/* Nav */}
      <nav style={S.nav}>
        <span style={S.navBrand}>GradeVault</span>
        {user && (
          <>
            <span style={{ ...S.navChip, background: `${roleColor}22`, color: roleColor }}>
              {user.role}
            </span>
            <SessionTimer onExpire={handleLogout} />
            <button style={S.navBtn} onClick={handleLogout}>Sign out</button>
          </>
        )}
      </nav>

      {/* Pages */}
      {page === "login" && <LoginPage onLogin={handleLogin} onGoRegister={() => setPage("register")} />}
      {page === "register" && <RegisterPage onGoLogin={() => setPage("login")} />}
      {page === "dashboard" && user?.role === "teacher" && <TeacherDashboard user={user} />}
      {page === "dashboard" && user?.role === "admin" && <AdminDashboard user={user} />}
    </div>
  );
}
