# INFO3604 Project - Backend

**Repository:** https://github.com/WGP-Industries/INFO3604-Project-Backend

A Node.js REST API that handles authentication, xAPI statement ingestion, LRS forwarding, and enrollment management for the Student Analysis xAPI platform. Designed to support COMP 3609 (Game Programming) and COMP 3610 (Big Data Analytics).

---

## Table of Contents

- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Database Seeding](#database-seeding)
- [Running the Server](#running-the-server)
- [Authentication](#authentication)
- [API Reference](#api-reference)
- [Data Models](#data-models)
- [LRS Integration](#lrs-integration)

---

## Overview

The backend stores user accounts, course definitions, group enrollments, and a local copy of every xAPI statement submitted. Each statement is also forwarded to a remote LRS (Veracity). Admins have access to unscoped data endpoints and aggregated statistics. All protected routes require a valid JWT and, where noted, an admin role.

---

## Technology Stack

| Concern          | Library / Tool                 |
| ---------------- | ------------------------------ |
| Runtime          | Node.js 18+ (ESM)              |
| Framework        | Express 4                      |
| Database         | MongoDB via Mongoose           |
| Auth             | JSON Web Tokens (jsonwebtoken) |
| Password hashing | bcryptjs                       |
| LRS forwarding   | node-fetch                     |
| Config           | dotenv                         |

---

## Project Structure

```
├── config/
│   ├── db.js               # Mongoose connection
│   └── lrs.js              # LRS header factory (reads env vars lazily)
├── middleware/
│   └── auth.js             # protect (JWT guard) and adminOnly (role guard)
├── models/
│   ├── User.js             # username, email, password, role
│   ├── Course.js           # courseCode, name, uri, project
│   ├── Group.js            # name, slug, course
│   ├── Enrollment.js       # user + course + group + projectStatus
│   └── Statement.js        # xAPI statement local copy + LRS sync state
├── routes/
│   ├── userRoutes.js       # Auth and user management
│   ├── courseRoutes.js     # Course and group management
│   ├── xapiRoutes.js       # Statement ingestion, retrieval, admin stats
│   └── enrollmentRoutes.js # Enrollment CRUD
├── scripts/
│   └── seed.js             # Seeds courses and initial admin account
└── server.js               # Express app entry point
```

---

## Prerequisites

- Node.js 18 or higher
- A running MongoDB instance (local or Atlas)
- A Veracity (or compatible xAPI) LRS account with endpoint credentials

---

## Installation

```bash
git clone https://github.com/WGP-Industries/INFO3604-Project-Backend.git
cd INFO3604-Project-Backend
npm install
```

---

## Environment Variables

Create a `.env` file in the project root. All five core variables are required - the server will exit on startup if any are missing.

```env
MONGODB_URI=mongodb://localhost:27017/info3604
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d
LRS_ENDPOINT=https://your-lrs.io/xapi/statements
LRS_USERNAME=your_lrs_username
LRS_PASSWORD=your_lrs_password
PORT=3000
CORS_ORIGIN=http://localhost:5173
```

| Variable         | Description                                          |
| ---------------- | ---------------------------------------------------- |
| `MONGODB_URI`    | Full MongoDB connection string                       |
| `JWT_SECRET`     | Secret used to sign and verify tokens                |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `7d`, `24h`                     |
| `LRS_ENDPOINT`   | Full URL to the xAPI statements endpoint on your LRS |
| `LRS_USERNAME`   | LRS Basic Auth username                              |
| `LRS_PASSWORD`   | LRS Basic Auth password                              |
| `PORT`           | Port the Express server listens on (default: 3000)   |
| `CORS_ORIGIN`    | Comma-separated list of allowed origins              |

### Important Note on Environment Variable Loading

`dotenv.config()` is called as the very first statement in `server.js`, before any other imports. This is required because Node.js ESM hoists and evaluates all `import` statements before any code runs. Any module that reads `process.env` at the top level - outside of a function - will receive `undefined` if `dotenv.config()` has not already executed.

All LRS configuration in `config/lrs.js` reads `process.env` lazily inside the `lrsHeaders()` function rather than at module load time, for the same reason.

---

## Database Seeding

Before using the application, run the seed script to create the two course records and an initial admin account.

```bash
node scripts/seed.js
```

This will upsert the following courses:

| Course Code | Project                                                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| COMP3609    | 2D Platform Game - Java 2D Graphics API, game loop, animated sprites, collision detection, sound, tile maps, design patterns        |
| COMP3610    | Data Analytics Application - real-world dataset, analysis algorithms, working application or dashboard, IEEE-formatted final report |

It will also create an admin user if one does not already exist. If the user exists but lacks the admin role, the role is corrected automatically.

Default admin credentials:

```
Email:    admin@example.edu
Password: Admin@1234
```

Change the admin password after first login.

---

## Running the Server

```bash
# Development (with nodemon)
npm run dev

# Production
npm start
```

The server logs the port and environment on startup. A health check is available at `GET /api/health`.

---

## Authentication

All protected routes require a `Bearer` token in the `Authorization` header:

```
Authorization: Bearer <jwt>
```

Tokens are issued on login and registration. Both `protect` and `adminOnly` are exported from `middleware/auth.js` as a default object and composed on routes as needed:

```js
import auth from "../middleware/auth.js";

router.get("/route", auth.protect, auth.adminOnly, handler);
```

`protect` verifies the JWT and attaches the full user document to `req.user`. `adminOnly` checks `req.user.role === "admin"` and returns `403` if the check fails. It must always be used after `protect`.

---

## API Reference

### User - `/api/user`

| Method | Path        | Auth    | Description                              |
| ------ | ----------- | ------- | ---------------------------------------- |
| POST   | `/register` | None    | Register a new student account           |
| POST   | `/login`    | None    | Authenticate and receive a JWT           |
| GET    | `/me`       | Student | Return the current authenticated user    |
| GET    | `/all`      | Admin   | List all users sorted by creation date   |
| PATCH  | `/:id/role` | Admin   | Set a user's role (`student` or `admin`) |
| DELETE | `/:id`      | Admin   | Delete a user account                    |

**Register body:**

```json
{ "username": "jane.doe", "email": "jane@example.com", "password": "secret123" }
```

**Login body:**

```json
{ "email": "jane@example.com", "password": "secret123" }
```

**Login / Register response:**

```json
{
  "token": "<jwt>",
  "user": { "_id": "...", "username": "...", "email": "...", "role": "student" }
}
```

---

### Courses - `/api/courses`

| Method | Path                           | Auth    | Description                     |
| ------ | ------------------------------ | ------- | ------------------------------- |
| GET    | `/`                            | Student | List all courses                |
| GET    | `/:courseCode/groups`          | Student | List all groups for a course    |
| POST   | `/:courseCode/groups`          | Admin   | Create a new group for a course |
| DELETE | `/:courseCode/groups/:groupId` | Admin   | Delete a group from a course    |

**POST `/:courseCode/groups` body:**

```json
{ "name": "Group D", "slug": "group-d" }
```

---

### xAPI - `/api/xapi`

| Method | Path                | Auth    | Description                                           |
| ------ | ------------------- | ------- | ----------------------------------------------------- |
| POST   | `/`                 | Student | Submit an xAPI statement                              |
| GET    | `/statements`       | Student | Fetch statements scoped to the current user           |
| GET    | `/admin/statements` | Admin   | Fetch all statements (unscoped) with optional filters |
| GET    | `/admin/stats`      | Admin   | Aggregated platform statistics                        |

**POST `/api/xapi` body:**

```json
{
  "statement": {},
  "additionalData": {
    "description": "Optional context string",
    "courseId": "comp3609"
  }
}
```

The verb URI is inspected to resolve the course automatically. A URI containing `example.edu/comp3609` maps to COMP3609 and `example.edu/comp3610` maps to COMP3610. The user's group is resolved from their enrollment in that course at the time of submission.

**GET `/api/xapi/admin/statements` query parameters:**

| Parameter | Description                                         |
| --------- | --------------------------------------------------- |
| `course`  | Filter by course code, e.g. `COMP3609`              |
| `group`   | Filter by group ObjectId string                     |
| `verb`    | Case-insensitive partial match on verb display name |
| `stage`   | Filter by stage value                               |
| `userId`  | Filter by user ObjectId                             |
| `limit`   | Maximum records to return (default 100, max 500)    |

**GET `/api/xapi/admin/stats` response shape:**

```json
{
  "totals": { "users": 0, "statements": 0, "enrollments": 0, "lrsSynced": 0 },
  "statementsByCourse": [{ "courseCode": "COMP3609", "count": 0 }],
  "statementsByGroup": [{ "name": "Group A", "slug": "group-a", "count": 0 }],
  "statementsByVerb": [{ "_id": "Implemented", "count": 0 }],
  "statementsByStage": [{ "_id": "stage-value", "count": 0 }],
  "recentStatements": [{ "_id": "2025-01-01", "count": 0 }]
}
```

---

### Enrollments - `/api/enrollments`

| Method | Path              | Auth    | Description                                             |
| ------ | ----------------- | ------- | ------------------------------------------------------- |
| GET    | `/my`             | Student | All enrollments for the current user                    |
| GET    | `/my/:courseCode` | Student | Single enrollment for a given course                    |
| POST   | `/join`           | Student | Join or switch group for a course                       |
| GET    | `/`               | Admin   | All enrollments, filterable by `?course=` and `?group=` |
| POST   | `/`               | Admin   | Manually enroll a student by email                      |
| PATCH  | `/:id`            | Admin   | Update group or project status                          |
| DELETE | `/:id`            | Admin   | Remove an enrollment                                    |

**POST `/api/enrollments/join` body:**

```json
{ "courseCode": "comp3609", "groupId": "<ObjectId>" }
```

**POST `/api/enrollments` (admin) body:**

```json
{
  "email": "student@example.com",
  "courseCode": "COMP3610",
  "groupId": "<ObjectId>"
}
```

**PATCH `/api/enrollments/:id` body:**

```json
{ "groupId": "<ObjectId>", "projectStatus": "completed" }
```

Valid project statuses: `not-started`, `in-progress`, `completed`. Setting `completed` automatically records `projectCompletedAt`.

---

## Data Models

### User

| Field      | Type   | Notes                                           |
| ---------- | ------ | ----------------------------------------------- |
| `username` | String | Unique                                          |
| `email`    | String | Unique, lowercase                               |
| `password` | String | bcrypt-hashed, excluded from queries by default |
| `role`     | String | `student` (default) or `admin`                  |

### Course

| Field                 | Type   | Notes                                        |
| --------------------- | ------ | -------------------------------------------- |
| `courseCode`          | String | Unique, uppercase - `COMP3609` or `COMP3610` |
| `name`                | String | Full display name                            |
| `description`         | String | Course summary                               |
| `uri`                 | String | xAPI activity ID base                        |
| `project.name`        | String | Project title                                |
| `project.description` | String | Project summary                              |

### Group

| Field    | Type     | Notes                               |
| -------- | -------- | ----------------------------------- |
| `name`   | String   | Display name, e.g. `Group A`        |
| `slug`   | String   | URL-safe identifier, e.g. `group-a` |
| `course` | ObjectId | Ref: Course                         |

Unique index on `{ course, slug }`.

### Enrollment

| Field                | Type     | Notes                                     |
| -------------------- | -------- | ----------------------------------------- |
| `user`               | ObjectId | Ref: User                                 |
| `course`             | ObjectId | Ref: Course                               |
| `group`              | ObjectId | Ref: Group                                |
| `projectStatus`      | String   | `not-started`, `in-progress`, `completed` |
| `projectStartedAt`   | Date     | Set on first join                         |
| `projectCompletedAt` | Date     | Set when status is marked completed       |

Unique index on `{ user, course }` - one enrollment per student per course.

### Statement

| Field            | Type     | Notes                                                   |
| ---------------- | -------- | ------------------------------------------------------- |
| `user`           | ObjectId | Ref: User                                               |
| `course`         | ObjectId | Ref: Course, nullable                                   |
| `group`          | ObjectId | Ref: Group, resolved from enrollment at submission time |
| `verb.uri`       | String   | Full verb URI                                           |
| `verb.display`   | String   | Human-readable verb label                               |
| `stage`          | String   | Stage of the activity                                   |
| `scenario`       | String   | Scenario context for the statement                      |
| `description`    | String   | Optional context, max 500 characters                    |
| `rawStatement`   | Mixed    | Full xAPI statement JSON                                |
| `lrsSynced`      | Boolean  | True once LRS confirms receipt                          |
| `lrsStatementId` | String   | ID returned by the LRS                                  |

Indexes on `{ user, createdAt }`, `{ group, createdAt }`, `{ course, createdAt }`.

---

## LRS Integration

When a statement is submitted to `POST /api/xapi`, the server:

1. Saves a local copy to MongoDB immediately.
2. Forwards the raw xAPI statement to `process.env.LRS_ENDPOINT` using HTTP Basic Auth headers built by `lrsHeaders()`.
3. If the LRS accepts the statement, updates the local record with `lrsSynced: true` and stores the returned `lrsStatementId`.
4. If the LRS is unreachable or rejects the statement, the local record is retained and the response indicates partial success. Failed statements can be identified via `lrsSynced: false`.

Login events are also sent to the LRS as fire-and-forget statements on every successful authentication. Failures are logged server-side but do not affect the login response.
