# CampusConnect

CampusConnect is a private college social network and academic activity management system built according to the System Architecture and Functional Specification.

## Key Features
- **CSV-Gated Registration**: Only emails whitelisted in `students.csv`, `teachers.csv`, or `admins.csv` can register.
- **Strict Server-Side RBAC**: Role-based access control tokens (JWT) with separate permissions for Students, Teachers, and Admins.
- **Instagram-Style Talent Feed**: Mandatory media categories (`Dance`, `Singing`, `Painting`, `Technical`, `Photography`, `Others`), likes, and comments.
- **Academic Attendance Engine**: Attendance tracking with real-time automated notifications whenever a student's percentage drops below 75%.
- **Schedules & Seating Allocation**: Private room & seat allocation view for students and automated venue clash checking across rooms and schedules.
- **Admin Moderation & Audit Logs**: Upload CSV records, moderate posts, and inspect system audit logs.

## Setup Instructions

### 1. Database (PostgreSQL)
```bash
cd backend
cp .env.example .env
# Set DB_PASSWORD to your PostgreSQL user's password in .env.
node setup-db.js
```

The setup script creates `campusconnect_db` if needed and applies the schema in
`backend/src/db/schema.sql`. If you use `DATABASE_URL`, provide valid PostgreSQL
credentials; the script connects to the `postgres` maintenance database first.

To allow users to register, import the college-approved roster into the
authorized-records whitelist. Each CSV must have a unique `usn_or_employee_id`
column in addition to the name and email columns:

```csv
name,email,usn_or_employee_id
```

The importer infers each role from the exact filenames `student.csv`,
`teacher.csv`, and `admin.csv`. It accepts `name`/`email` or the database-style
`full_name`/`college_email` headers. The IDs must be the actual college USN or
employee IDs, not generated values. Import all files together using the paths
to your local roster files:

```powershell
node import-authorized-records.js "C:\path\to\admin.csv" "C:\path\to\teacher.csv" "C:\path\to\student.csv"
```

The import validates the entire file and uses a transaction; invalid rows or
conflicts with existing records prevent the import. After a successful import,
register using the exact email and role from the roster, then log in with that
email and the password chosen during registration.

### 2. Backend API
```bash
cd backend
npm install
npm run dev
```

### 3. Frontend App
```bash
cd frontend
npm install
npm run dev
```
