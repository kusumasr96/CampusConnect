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
createdb campusconnect_db
psql campusconnect_db < backend/src/db/schema.sql
```

### 2. Backend API
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

### 3. Frontend App
```bash
cd frontend
npm install
npm run dev
```
