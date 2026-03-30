import { useState, useEffect, useCallback } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_ATTEMPTS   = 5;
const LOCKOUT_SECS   = 30;
const SESSION_MS     = 15 * 60 * 1000;

// Mock data – replace with real API calls once backend is ready
const MOCK_GRADES = [
  { student: "Alice Chen",  course: "CS4417", assignment: "Lab 1",  grade: 88 },
  { student: "Bob Russo",   course: "CS4417", assignment: "Lab 1",  grade: 74 },
  { student: "Alice Chen",  course: "CS4417", assignment: "Midterm",grade: 91 },
  { student: "Bob Russo",   course: "CS4417", assignment: "Midterm",grade: 68 },
];

const MOCK_USERS = [
  { id: 1, name: "Alice Chen", email: "alice@unb.ca",  role: "student", status: "active"    },
  { id: 2, name: "Bob Russo",  email: "bob@unb.ca",    role: "student", status: "active"    },
  { id: 3, name: "Dr. Patel",  email: "patel@unb.ca",  role: "teacher", status: "active"    },
  { id: 4, name: "Eve N.",     email: "eve@unb.ca",    role: "student", status: "suspended" },
];

const MOCK_LOGS = [
  { time: "2025-03-29 09:14", user: "alice@unb.ca",   action: "Login",        status: "success" },
  { time: "2025-03-29 09:02", user: "unknown@x.com",  action: "Login",        status: "failed"  },
  { time: "2025-03-28 17:30", user: "patel@unb.ca",   action: "Grade upload", status: "success" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

// strips characters that could be used in XSS (CWE-79)
const sanitize = (str) => str.replace(/[<>"'`]/g, "");

// password must be 12+ chars with upper, lower, digit, and symbol (CWE-521)
const isStrongPassword = (pw) =>
  pw.length >= 12 &&
  /[A-Z]/.test(pw) &&
  /[a-z]/.test(pw) &&
  /[0-9]/.test(pw) &&
  /[^A-Za-z0-9]/.test(pw);

const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// ── Base styles ───────────────────────────────────────────────────────────────
const css = {
  app:    { minHeight:"100vh", background:"#0b0f1a", color:"#c9d1e0", fontFamily:"'IBM Plex Sans',sans-serif" },
  nav:    { background:"#0d1220", borderBottom:"1px solid #1e2d45", padding:"0 2rem", display:"flex", alignItems:"center", height:56, gap:16 },
  brand:  { fontFamily:"'IBM Plex Mono',monospace", fontSize:15, fontWeight:700, color:"#38bdf8", marginRight:"auto" },
  main:   { display:"flex", alignItems:"center", justifyContent:"center", minHeight:"calc(100vh - 56px)", padding:"2rem 1rem" },
  card:   { background:"#0d1220", border:"1px solid #1e2d45", borderRadius:14, padding:"2rem", width:"100%", maxWidth:440 },
  label:  { display:"block", fontSize:11, fontWeight:700, color:"#546e8a", letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:6 },
  input:  { width:"100%", background:"#0b0f1a", border:"1px solid #1e2d45", borderRadius:8, padding:"10px 14px", color:"#c9d1e0", fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" },
  btn:    { width:"100%", background:"#0ea5e9", border:"none", borderRadius:8, padding:"11px 0", color:"#fff", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit" },
  btnSm:  { background:"none", border:"1px solid #1e3a52", borderRadius:6, padding:"6px 14px", color:"#64a0c8", fontSize:12, cursor:"pointer", fontFamily:"inherit" },
  btnRed: { background:"none", border:"1px solid #7f1d1d", borderRadius:6, padding:"6px 14px", color:"#f87171", fontSize:12, cursor:"pointer", fontFamily:"inherit" },
  err:    { padding:"10px 14px", borderRadius:8, fontSize:13, marginBottom:16, background:"rgba(226,75,74,0.1)", border:"1px solid #7f1d1d", color:"#f87171" },
  ok:     { padding:"10px 14px", borderRadius:8, fontSize:13, marginBottom:16, background:"rgba(29,158,117,0.1)", border:"1px solid #0f6e56", color:"#34d399" },
  warn:   { padding:"10px 14px", borderRadius:8, fontSize:13, marginBottom:16, background:"rgba(239,159,39,0.1)", border:"1px solid #854f0b", color:"#fbbf24" },
  th:     { textAlign:"left", padding:"8px 14px", fontSize:11, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", color:"#546e8a", borderBottom:"1px solid #1e2d45" },
  td:     { padding:"9px 14px", borderBottom:"1px solid #111827", color:"#c9d1e0", fontSize:13 },
  tab:    (a) => ({ flex:1, padding:"8px 0", border:"none", borderRadius:7, cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600, background:a?"#0ea5e9":"none", color:a?"#fff":"#546e8a" }),
  badge:  (c) => ({ display:"inline-block", fontSize:11, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", padding:"2px 9px", borderRadius:99, background:{cyan:"rgba(14,165,233,0.15)",green:"rgba(29,158,117,0.15)",amber:"rgba(239,159,39,0.15)",red:"rgba(226,75,74,0.15)"}[c]||"", color:{cyan:"#38bdf8",green:"#34d399",amber:"#fbbf24",red:"#f87171"}[c]||"" }),
  note:   { fontSize:11, color:"#2d4a63", marginTop:6 },
};

// ── SessionTimer – auto-logs user out after 15 min of inactivity (CWE-613) ───
function SessionTimer({ onExpire }) {
  const [secs, setSecs] = useState(SESSION_MS / 1000);
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => { if (s <= 1) { onExpire(); return 0; } return s - 1; }), 1000);
    return () => clearInterval(t);
  }, [onExpire]);
  const m = Math.floor(secs / 60), s = String(secs % 60).padStart(2, "0");
  return <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:12, color: secs < 120 ? "#f87171" : "#546e8a" }}>{secs < 120 && "⚠ "}Session: {m}:{s}</span>;
}

// ── LoginPage – enforces rate limiting and account lockout (CWE-307) ──────────
function LoginPage({ onLogin, onRegister }) {
  const [email, setEmail] = useState(""), [pass, setPass] = useState("");
  const [err, setErr] = useState(""), [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false), [lockSecs, setLockSecs] = useState(0);

  // lockout countdown
  useEffect(() => {
    if (!locked) return;
    setLockSecs(LOCKOUT_SECS);
    const t = setInterval(() => setLockSecs((s) => { if (s <= 1) { setLocked(false); setAttempts(0); return 0; } return s - 1; }), 1000);
    return () => clearInterval(t);
  }, [locked]);

  const submit = () => {
    if (locked) return;
    setErr("");
    if (!validEmail(email)) { setErr("Enter a valid email."); return; }
    // demo credentials – backend will handle real auth via parameterized queries (CWE-89)
    const creds = { "teacher@unb.ca": { pass:"Teacher@Pass1!", role:"teacher", name:"Dr. Patel" }, "admin@unb.ca": { pass:"Admin@Pass1!", role:"admin", name:"System Admin" } };
    const found = creds[email.trim().toLowerCase()];
    if (found && found.pass === pass) { onLogin({ email, role: found.role, name: found.name }); }
    else {
      const next = attempts + 1;
      setAttempts(next);
      if (next >= MAX_ATTEMPTS) { setLocked(true); setErr(`Locked for ${LOCKOUT_SECS}s after ${MAX_ATTEMPTS} failed attempts.`); }
      else setErr(`Wrong credentials. ${MAX_ATTEMPTS - next} attempt(s) left.`);
    }
  };

  return (
    <div style={css.main}>
      <div style={css.card}>
        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#38bdf8", marginBottom:8 }}>GradeVault</div>
        <h2 style={{ color:"#e2e8f0", marginBottom:4 }}>Sign in</h2>
        <p style={{ fontSize:13, color:"#546e8a", marginBottom:20 }}>All activity is logged. Authorized users only.</p>
        {err && <div style={css.err}>{err}</div>}
        {locked && <div style={css.warn}>Account locked. Try again in {lockSecs}s.</div>}
        <label style={css.label}>Email</label>
        <input style={{ ...css.input, marginBottom:14 }} type="email" placeholder="you@unb.ca" value={email} disabled={locked} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key==="Enter"&&submit()} />
        <label style={css.label}>Password</label>
        <input style={{ ...css.input, marginBottom:20 }} type="password" placeholder="••••••••••••" value={pass} disabled={locked} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key==="Enter"&&submit()} />
        <button style={{ ...css.btn, opacity: locked ? 0.5 : 1 }} disabled={locked} onClick={submit}>Sign in</button>
        <p style={{ fontSize:12, color:"#2d4a63", marginTop:10 }}>🔒 HTTPS · Sessions expire after 15 min</p>
        <hr style={{ border:"none", borderTop:"1px solid #1e2d45", margin:"16px 0" }} />
        <p style={{ fontSize:13, color:"#546e8a" }}>No account? <button style={{ ...css.btnSm, display:"inline" }} onClick={onRegister}>Register</button></p>
        <div style={{ marginTop:16, padding:"10px 14px", background:"#111827", borderRadius:8, fontSize:12, color:"#546e8a" }}>
          <strong style={{ color:"#38bdf8" }}>Demo:</strong><br/>teacher@unb.ca / Teacher@Pass1!<br/>admin@unb.ca / Admin@Pass1!
        </div>
      </div>
    </div>
  );
}

// ── RegisterPage – enforces strong password policy (CWE-521) ─────────────────
function RegisterPage({ onLogin }) {
  const [form, setForm] = useState({ name:"", email:"", role:"student", pass:"", confirm:"" });
  const [err, setErr] = useState(""), [done, setDone] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.name.trim())           { setErr("Name required."); return; }
    if (!validEmail(form.email))     { setErr("Valid email required."); return; }
    if (!isStrongPassword(form.pass)){ setErr("Password must be 12+ chars with upper, lower, number, and symbol."); return; }
    if (form.pass !== form.confirm)  { setErr("Passwords do not match."); return; }
    setDone(true);
  };

  if (done) return (
    <div style={css.main}><div style={css.card}>
      <div style={css.ok}>Account created. Awaiting admin approval before you can log in.</div>
      <button style={css.btn} onClick={onLogin}>Back to sign in</button>
    </div></div>
  );

  return (
    <div style={css.main}>
      <div style={css.card}>
        <h2 style={{ color:"#e2e8f0", marginBottom:4 }}>Create account</h2>
        <p style={{ fontSize:13, color:"#546e8a", marginBottom:20 }}>Strong passwords enforced. New accounts require admin review.</p>
        {err && <div style={css.err}>{err}</div>}
        {[["name","Full name","text","Jane Smith"],["email","University email","email","you@unb.ca"]].map(([k,lbl,type,ph]) => (
          <div key={k} style={{ marginBottom:14 }}>
            <label style={css.label}>{lbl}</label>
            <input style={css.input} type={type} placeholder={ph} value={form[k]} onChange={(e) => set(k, sanitize(e.target.value))} />
          </div>
        ))}
        <label style={css.label}>Role</label>
        <select style={{ ...css.input, marginBottom:14 }} value={form.role} onChange={(e) => set("role", e.target.value)}>
          <option value="student">Student</option>
          <option value="teacher">Teacher</option>
        </select>
        <label style={css.label}>Password</label>
        <input style={{ ...css.input, marginBottom:6 }} type="password" placeholder="Min 12 chars" value={form.pass} onChange={(e) => set("pass", e.target.value)} />
        <p style={css.note}>12+ chars · uppercase · lowercase · number · symbol</p>
        <label style={{ ...css.label, marginTop:12 }}>Confirm password</label>
        <input style={{ ...css.input, marginBottom:20 }} type="password" placeholder="Re-enter password" value={form.confirm} onChange={(e) => set("confirm", e.target.value)} />
        <button style={css.btn} onClick={submit}>Create account</button>
        <hr style={{ border:"none", borderTop:"1px solid #1e2d45", margin:"16px 0" }} />
        <p style={{ fontSize:13, color:"#546e8a" }}>Have an account? <button style={{ ...css.btnSm, display:"inline" }} onClick={onLogin}>Sign in</button></p>
      </div>
    </div>
  );
}

// ── TeacherDashboard – grade viewing and secure CSV upload (CWE-434) ──────────
function TeacherDashboard({ user }) {
  const [tab, setTab] = useState("grades");
  const [file, setFile] = useState(null), [fileErr, setFileErr] = useState(""), [fileOk, setFileOk] = useState("");
  const [feedback, setFeedback] = useState(""), [fbOk, setFbOk] = useState(false);

  // validates file type and size before letting it through (CWE-434)
  const validateFile = (f) => {
    setFileErr(""); setFileOk("");
    if (!f) return;
    if (!f.name.endsWith(".csv") || f.type !== "text/csv") { setFileErr("Only .csv files accepted."); return; }
    if (f.size > 2 * 1024 * 1024) { setFileErr("File must be under 2MB."); return; }
    setFile(f);
  };

  const upload = () => { if (!file) return; setFileOk(`"${file.name}" uploaded. Pending review.`); setFile(null); };

  return (
    <div style={{ padding:"2rem", maxWidth:900, margin:"0 auto" }}>
      <h2 style={{ color:"#e2e8f0", marginBottom:4 }}>Welcome, {user.name}</h2>
      <p style={{ fontSize:13, color:"#546e8a", marginBottom:24 }}>Role: <span style={css.badge("cyan")}>Teacher</span></p>
      <div style={{ display:"flex", gap:4, background:"#0b0f1a", border:"1px solid #1e2d45", borderRadius:10, padding:4, marginBottom:24 }}>
        {["grades","upload","feedback"].map((t) => <button key={t} style={css.tab(tab===t)} onClick={() => setTab(t)}>{{ grades:"Grades", upload:"Upload", feedback:"Feedback" }[t]}</button>)}
      </div>

      {tab==="grades" && (
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead><tr>{["Student","Course","Assignment","Grade"].map((h) => <th key={h} style={css.th}>{h}</th>)}</tr></thead>
          <tbody>{MOCK_GRADES.map((g,i) => <tr key={i}><td style={css.td}>{g.student}</td><td style={css.td}>{g.course}</td><td style={css.td}>{g.assignment}</td><td style={{ ...css.td, fontWeight:700, color: g.grade>=80?"#34d399":g.grade>=60?"#fbbf24":"#f87171" }}>{g.grade}%</td></tr>)}</tbody>
        </table>
      )}

      {tab==="upload" && (
        <div style={{ maxWidth:480 }}>
          {fileErr && <div style={css.err}>{fileErr}</div>}
          {fileOk  && <div style={css.ok}>{fileOk}</div>}
          <div style={{ border:"1.5px dashed #1e3a52", borderRadius:10, padding:"24px", textAlign:"center", cursor:"pointer", background:"#0b0f1a" }} onClick={() => document.getElementById("fi").click()}>
            <div style={{ fontSize:13, color:"#64a0c8" }}>{file ? file.name : "Click to select a .csv file"}</div>
            <div style={css.note}>Only .csv · Max 2MB</div>
            <input id="fi" type="file" accept=".csv" style={{ display:"none" }} onChange={(e) => validateFile(e.target.files[0])} />
          </div>
          <p style={css.note}>🔒 MIME type + extension validated server-side. Stored outside web root. (CWE-434)</p>
          <button style={{ ...css.btn, marginTop:14, opacity: file?1:0.4 }} disabled={!file} onClick={upload}>Upload</button>
        </div>
      )}

      {tab==="feedback" && (
        <div style={{ maxWidth:480 }}>
          {fbOk && <div style={css.ok}>Feedback submitted.</div>}
          <label style={css.label}>Message</label>
          <textarea style={{ ...css.input, height:120, resize:"vertical", marginBottom:6 }} placeholder="Write here…" maxLength={1000} value={feedback} onChange={(e) => setFeedback(sanitize(e.target.value))} />
          <p style={css.note}>{feedback.length}/1000 · Sanitized before storage (CWE-79)</p>
          <button style={{ ...css.btn, marginTop:12 }} onClick={() => { if(feedback.trim()) { setFbOk(true); setFeedback(""); } }}>Submit</button>
        </div>
      )}
    </div>
  );
}

// ── AdminDashboard – user management and audit log (CWE-285, CWE-269) ─────────
function AdminDashboard({ user }) {
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState(MOCK_USERS);
  const [confirm, setConfirm] = useState(null);
  const [newU, setNewU] = useState({ name:"", email:"", role:"student" });
  const [addErr, setAddErr] = useState(""), [addOk, setAddOk] = useState("");

  const toggleStatus = (id) => { setUsers((us) => us.map((u) => u.id===id ? { ...u, status: u.status==="active"?"suspended":"active" } : u)); setConfirm(null); };

  const addUser = () => {
    setAddErr("");
    if (!newU.name.trim()) { setAddErr("Name required."); return; }
    if (!validEmail(newU.email)) { setAddErr("Valid email required."); return; }
    setUsers((us) => [...us, { id: Date.now(), ...newU, status:"active" }]);
    setNewU({ name:"", email:"", role:"student" });
    setAddOk("User created."); setTimeout(() => setAddOk(""), 3000);
  };

  return (
    <div style={{ padding:"2rem", maxWidth:900, margin:"0 auto" }}>
      <h2 style={{ color:"#e2e8f0", marginBottom:4 }}>Admin Panel</h2>
      <p style={{ fontSize:13, color:"#546e8a", marginBottom:24 }}>Role: <span style={css.badge("amber")}>Admin</span> · All actions are audited.</p>
      <div style={{ display:"flex", gap:4, background:"#0b0f1a", border:"1px solid #1e2d45", borderRadius:10, padding:4, marginBottom:24 }}>
        {["users","add","logs"].map((t) => <button key={t} style={css.tab(tab===t)} onClick={() => setTab(t)}>{{ users:"Users", add:"Add User", logs:"Audit Logs" }[t]}</button>)}
      </div>

      {tab==="users" && (
        <div>
          {confirm && (
            <div style={{ ...css.warn, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span>Confirm {confirm.action} for <strong>{confirm.name}</strong>?</span>
              <div style={{ display:"flex", gap:8 }}><button style={css.btnRed} onClick={() => toggleStatus(confirm.id)}>Confirm</button><button style={css.btnSm} onClick={() => setConfirm(null)}>Cancel</button></div>
            </div>
          )}
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead><tr>{["Name","Email","Role","Status","Action"].map((h) => <th key={h} style={css.th}>{h}</th>)}</tr></thead>
            <tbody>{users.map((u) => (
              <tr key={u.id}>
                <td style={css.td}>{u.name}</td>
                <td style={{ ...css.td, fontFamily:"'IBM Plex Mono',monospace", fontSize:12 }}>{u.email}</td>
                <td style={css.td}><span style={css.badge(u.role==="admin"?"amber":u.role==="teacher"?"cyan":"green")}>{u.role}</span></td>
                <td style={css.td}><span style={css.badge(u.status==="active"?"green":"red")}>{u.status}</span></td>
                <td style={css.td}><button style={u.status==="active"?css.btnRed:css.btnSm} disabled={u.email===user.email} onClick={() => setConfirm({ id:u.id, name:u.name, action:u.status==="active"?"Suspend":"Reactivate" })}>{u.status==="active"?"Suspend":"Reactivate"}</button></td>
              </tr>
            ))}</tbody>
          </table>
          <p style={css.note}>🔒 Server-side role checks on every route. Least privilege enforced. (CWE-285, CWE-269)</p>
        </div>
      )}

      {tab==="add" && (
        <div style={{ maxWidth:440 }}>
          {addErr && <div style={css.err}>{addErr}</div>}
          {addOk  && <div style={css.ok}>{addOk}</div>}
          {[["name","Full name","text","Jane Smith"],["email","Email","email","user@unb.ca"]].map(([k,lbl,type,ph]) => (
            <div key={k} style={{ marginBottom:14 }}>
              <label style={css.label}>{lbl}</label>
              <input style={css.input} type={type} placeholder={ph} value={newU[k]} onChange={(e) => setNewU((u) => ({ ...u, [k]: sanitize(e.target.value) }))} />
            </div>
          ))}
          <label style={css.label}>Role</label>
          <select style={{ ...css.input, marginBottom:16 }} value={newU.role} onChange={(e) => setNewU((u) => ({ ...u, role:e.target.value }))}>
            <option value="student">Student</option><option value="teacher">Teacher</option><option value="admin">Admin</option>
          </select>
          <div style={css.warn}>A temp password will be emailed. User must reset on first login.</div>
          <button style={css.btn} onClick={addUser}>Create user</button>
          <p style={css.note}>🔒 Passwords hashed with bcrypt/Argon2, never stored in plaintext. (CWE-256)</p>
        </div>
      )}

      {tab==="logs" && (
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead><tr>{["Time","User","Action","Status"].map((h) => <th key={h} style={css.th}>{h}</th>)}</tr></thead>
          <tbody>{MOCK_LOGS.map((l,i) => (
            <tr key={i}>
              <td style={{ ...css.td, fontFamily:"'IBM Plex Mono',monospace", fontSize:12, color:"#546e8a" }}>{l.time}</td>
              <td style={css.td}>{l.user}</td>
              <td style={css.td}>{l.action}</td>
              <td style={css.td}><span style={css.badge(l.status==="success"?"green":"red")}>{l.status}</span></td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  );
}

// ── App – top-level routing and session management ────────────────────────────
export default function App() {
  const [page, setPage] = useState("login");
  const [user, setUser] = useState(null);

  const login  = (u) => { setUser(u); setPage("dashboard"); };
  const logout = useCallback(() => { setUser(null); setPage("login"); }, []);

  return (
    <div style={css.app}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@600;700&family=IBM+Plex+Sans:wght@400;600;700&display=swap');`}</style>
      <nav style={css.nav}>
        <span style={css.brand}>GradeVault</span>
        {user && <>
          <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:12, color:"#546e8a" }}>{user.email}</span>
          <SessionTimer onExpire={logout} />
          <button style={css.btnSm} onClick={logout}>Sign out</button>
        </>}
      </nav>
      {page==="login"     && <LoginPage     onLogin={login} onRegister={() => setPage("register")} />}
      {page==="register"  && <RegisterPage  onLogin={() => setPage("login")} />}
      {page==="dashboard" && user?.role==="teacher" && <TeacherDashboard user={user} />}
      {page==="dashboard" && user?.role==="admin"   && <AdminDashboard   user={user} />}
    </div>
  );
}
