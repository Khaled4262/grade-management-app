# GradeVault
 
A secure, role-based grade management system built as a full-stack web application.
 
The project demonstrates practical implementation of common security controls mapped to MITRE CWE entries, covering authentication, authorization, input validation, session management, audit logging, and secure file handling.
 
---
 
## Tech Stack
 
**Frontend**
- React (Vite)
- Vanilla CSS-in-JS (no component library)
- IBM Plex Sans / IBM Plex Mono (Google Fonts)
 
**Backend**
- Node.js + Express
- SQLite3 (via `sqlite3` package)
- `express-session` for cookie-based session management
- `bcrypt` for password hashing
- `multer` for CSV file uploads
- `csv-parser` for server-side CSV processing
- `express-validator` for input validation
- `express-rate-limit` for login rate limiting
---
 

## Database Schema
 
Four tables are created automatically on first run:
 
**users** — `id`, `full_name`, `email`, `password_hash`, `role` (`student` | `teacher` | `admin`), `status` (`pending` | `active` | `suspended`), `created_at`
 
**grades** — `id`, `student_id` (FK), `course`, `assignment`, `grade` (0–100), `uploaded_by` (FK), `created_at`
 
**audit_logs** — `id`, `user_email`, `action`, `status`, `ip_address`, `created_at`
 
**feedback** — `id`, `user_id` (FK), `message`, `created_at`
 
**grade_uploads** — `id`, `uploaded_by` (FK), `original_filename`, `stored_filename`, `created_at`
 
---
 
## Roles and Access
 
| Feature | Student | Teacher | Admin |
|---|---|---|---|
| View own grades | ✅ | — | — |
| View all grades | — | ✅ | ✅ |
| Upload CSV grades | — | ✅ | ✅ |
| Submit feedback | ✅ | ✅ | ✅ |
| Manage users | — | — | ✅ |
| Suspend / reactivate users | — | — | ✅ |
| View audit logs | — | — | ✅ |
| Add users (with temp password) | — | — | ✅ |
 
---
 
## API Endpoints
 
### Auth — `/auth`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Register new account (status: active) |
| POST | `/auth/login` | Public | Login, creates session |
| POST | `/auth/logout` | Any | Destroys session |
| GET | `/auth/me` | Any | Returns current session user |
| POST | `/auth/change-password` | Any | Change own password |
 
### Users — `/users`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/users` | Admin | List all users |
| GET | `/users/students` | Teacher, Admin | List students only |
| POST | `/users` | Admin | Create user, returns temp password |
| PATCH | `/users/:id/status` | Admin | Set user status (active/suspended/pending) |
 
### Grades — `/grades`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/grades` | Any | Returns all grades (teacher/admin) or own grades (student) |
| POST | `/grades/create` | Teacher, Admin | Create a single grade entry |
| POST | `/grades/upload` | Teacher, Admin | Upload CSV file of grades |
 
### Logs — `/logs`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/logs` | Admin | Returns last 100 audit log entries |
 
### Feedback — `/feedback`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/feedback` | Any | Submit feedback message (max 1000 chars) |
 
---
 
## Security Controls (CWE Mapped)
 
| CWE | Description | Implementation |
|---|---|---|
| CWE-79 | Cross-Site Scripting | Input sanitized on the frontend (`sanitize()`), validated server-side via `express-validator` |
| CWE-89 | SQL Injection | All DB queries use parameterized statements via `sqlite3` |
| CWE-256 | Plaintext Password Storage | Passwords hashed with `bcrypt` (cost factor 12), never stored in plaintext |
| CWE-307 | Brute Force | Frontend lockout after 5 failed attempts (30s); backend rate limiter (50 req/min per IP) via `express-rate-limit` |
| CWE-434 | Unrestricted File Upload | CSV upload validates extension + MIME type on both client and server; files stored outside web root with sanitized names |
| CWE-521 | Weak Password Requirements | Minimum 12 characters, requires uppercase, lowercase, digit, and symbol — enforced on both client and server |
| CWE-613 | Insufficient Session Expiration | Sessions expire after 15 minutes (frontend timer) and 1 hour (server cookie `maxAge`); session destroyed on logout |
| CWE-269 | Improper Privilege Management | Role-based middleware (`requireAuth`, `requireAdmin`, `requireTeacherOrAdmin`) enforced on every protected route |
| CWE-285 | Improper Authorization | Server checks session role on every request; frontend role-gating is UI-only and not relied upon for security |
 
---
 
## Setup and Installation
 
### Prerequisites
- Node.js v18+
- npm
 
### 1. Clone the repository
 
```bash
git clone <repo-url>
cd grade-management-app
```
 
### 2. Set up the backend
 
```bash
cd backend
npm install
```
 
Create a `.env` file in the `backend/` directory:
 
```env
SESSION_SECRET=your_long_random_secret_here
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=YourAdminPassword1!
NODE_ENV=development
PORT=3000
```
 
Seed the admin account:
 
```bash
node seedAdmin.js
```
 
Start the backend:
 
```bash
node server.js
```
 
The backend will start on `http://localhost:3000`. The SQLite database (`secureapp.db`) is created automatically in `backend/db/`.
 
### 3. Set up the frontend
 
```bash
cd ../frontend
npm install
npm run dev
```
 
The frontend will start on `http://localhost:5173`.
 
---
 
## CSV Upload Format
 
Teachers and admins can bulk-import grades via CSV. The file must follow this format:
 
```csv
student_id,course,assignment,grade
1,CS4417,Lab 1,88
2,CS4417,Lab 1,74
```
 
Rules enforced server-side:
- Extension must be `.csv`
- MIME type must be `text/csv` or `application/vnd.ms-excel`
- Maximum file size: 2MB
- `student_id` must be a valid integer matching a user in the database
- `grade` must be an integer between 0 and 100
- Invalid rows are skipped; valid rows are inserted
 
---
 
## Audit Logging
 
Every significant action is recorded in the `audit_logs` table, including:
 
- Login attempts (success, failed, blocked_pending, blocked_suspended)
- Logout
- Registration
- Password changes
- Admin user creation and status changes
- CSV grade uploads
- Feedback submissions
 
Logs are viewable by admins in the Audit Logs tab and include timestamp, user email, action, IP address, and status.
 
---
 
## Notes

- Accounts created by an admin are set to `active` immediately and issued a one-time temporary password shown only at creation time.
- Password change is supported on the backend (`POST /auth/change-password`) but not yet implemented in the frontend UI.
- An admin cannot suspend their own account.
- Session cookies are `httpOnly` and `sameSite: lax`. In production (`NODE_ENV=production`), the `secure` flag is enabled, requiring HTTPS.

## Contributing

This project was developed as a collaborative effort by the following team members:

### Project Leadership & Documentation
- **Khaled Al Tamimi** — Project creation, design, front-end development lead
   [github](https://github.com/Khaled4262)
- **Omar Matter** — Project creation, design, documentation
   [github](https://github.com/Omaranasmo)
- **Zohaib** — Project creation, design, back-end development lead
   [github](https://github.com/zohaibhassan02)
- **Jaspreet** —  Project creation, design, documentation
   [github](https://github.com/jaspreetUNB)

### Development
- **Khaled Al Tamimi** — Front-end development
- **Zohaib** — Back-end development

