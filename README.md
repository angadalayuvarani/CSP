<<<<<<< HEAD
# AquaTrack — Digital Water Complaint Management Portal

A full-stack web application that lets citizens digitally report water-related
problems (leakage, overflow, contamination, low pressure) and lets Water
Department / Municipal Corporation / Panchayat staff triage, assign, and
resolve them — with the citizen able to track status end to end.

Built to be a complete, runnable **B.Tech final year project**: simple stack,
clear folder structure, and no paid services required.

---

## 1. Tech stack

| Layer          | Technology                                             |
|-----------------|--------------------------------------------------------|
| Frontend        | HTML5, CSS3, Vanilla JavaScript (no framework needed)  |
| Backend         | Node.js + Express.js (REST API)                        |
| Database        | SQLite (file-based, zero setup — swap for MySQL later) |
| Auth            | JWT (JSON Web Tokens) + bcrypt password hashing         |
| File uploads    | Multer (complaint photo proof)                          |
| Location        | Browser Geolocation API (GPS) + manual address entry    |

This stack was chosen deliberately for a college project:
- **No database server to install** — SQLite is a single file (`aquatrack.sqlite`).
- **One backend serves everything** — API + frontend static files run from one
  `node server.js` command, so there's nothing extra to deploy or configure.
- Easy to explain in a viva: REST APIs, JWT auth, relational schema, CRUD.

> Want to use MySQL instead of SQLite for your submission? The schema in
> `backend/db/db.js` is plain SQL and ports over almost unchanged — swap the
> `sqlite3` driver for `mysql2` and adjust `AUTOINCREMENT` → `AUTO_INCREMENT`.

---

## 2. Project structure

```
aqua-track/
├── backend/
│   ├── server.js              # Express app entry point
│   ├── db/
│   │   ├── db.js              # DB connection + schema (auto-creates tables)
│   │   └── seed.js            # Creates default admin login + sample staff
│   ├── middleware/
│   │   ├── auth.js            # JWT verification + role guard
│   │   └── upload.js          # Multer config for complaint photos
│   ├── routes/
│   │   ├── auth.js            # /api/auth/register, /api/auth/login
│   │   ├── complaints.js      # citizen: submit / view own complaints
│   │   └── admin.js           # admin: list/filter/assign/update/stats
│   └── uploads/                # uploaded complaint photos (created at runtime)
│
└── frontend/
    ├── index.html              # public landing page
    ├── css/style.css           # single shared stylesheet (design tokens)
    ├── js/api.js                # shared fetch wrapper + session/auth helpers
    └── pages/
        ├── register.html        # citizen sign-up
        ├── login.html            # citizen login
        ├── admin-login.html      # admin login
        ├── citizen-dashboard.html  # citizen's complaint list
        ├── submit-complaint.html   # report a new issue (GPS + photo)
        ├── complaint-detail.html   # shared detail/timeline page (citizen + admin)
        ├── admin-dashboard.html    # stats dashboard
        └── admin-complaints.html   # filterable complaint management table
```

---

## 3. Database design

**users** — citizens and admins in one table, distinguished by `role`
| column | type | notes |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | |
| email | TEXT UNIQUE | login identifier |
| phone | TEXT | |
| password_hash | TEXT | bcrypt hash, never plaintext |
| role | TEXT | `citizen` \| `admin` |
| created_at | DATETIME | |

**staff** — water department field staff available for assignment
| column | type | notes |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | |
| phone | TEXT | |
| designation | TEXT | e.g. Field Technician |
| zone | TEXT | service area |

**complaints** — the core entity
| column | type | notes |
|---|---|---|
| id | INTEGER PK | |
| user_id | INTEGER FK → users | citizen who filed it |
| complaint_type | TEXT | Leakage / Overflow / Contamination / Low Pressure |
| description | TEXT | |
| latitude, longitude | REAL | from browser GPS, nullable |
| address | TEXT | manual/landmark address |
| image_path | TEXT | path to uploaded proof photo |
| status | TEXT | Submitted → Assigned → In Progress → Resolved → Closed |
| assigned_staff_id | INTEGER FK → staff | nullable until assigned |
| remarks | TEXT | latest admin remark |
| created_at, updated_at | DATETIME | |

**complaint_status_history** — audit trail, one row per status change
| column | type | notes |
|---|---|---|
| id | INTEGER PK | |
| complaint_id | INTEGER FK → complaints | |
| status | TEXT | status at this point in time |
| remarks | TEXT | |
| changed_by | INTEGER FK → users | who made the change |
| changed_at | DATETIME | |

This history table is what powers the "status timeline" citizens see on the
tracking page — every assignment and status update is logged automatically.

---

## 4. Workflow

```
CITIZEN                                   WATER DEPARTMENT (ADMIN)
--------                                   -------------------------
Register / Login
        |
Submit complaint  ------------------->    Complaint appears as "Submitted"
(type, description,                        in Admin Dashboard
 GPS/address, photo)
        |                                          |
        |                                  Views details, image, location
        |                                          |
        |                                  Assigns to field staff
        |  <----- status: "Assigned" -----          |
        |                                  Staff works on it in the field
        |                                          |
        |  <----- status: "In Progress" ---         |
        |                                  Issue resolved on-site
        |                                          |
        |  <----- status: "Resolved" -------        |
        |                                  Admin verifies & closes ticket
        |  <----- status: "Closed" ---------        |
        |
Tracks status anytime via
"My Complaints" → complaint detail page
```

The citizen never resolves the issue themselves — the portal's job stops at
**registration, assignment, monitoring, and tracking**, matching the brief.

---

## 5. Setup & run instructions

### Prerequisites
- [Node.js](https://nodejs.org) v18 or later installed

### Steps

```bash
# 1. Go into the backend folder
cd aqua-track/backend

# 2. Install dependencies
npm install

# 3. Create the default admin login + sample staff records
npm run seed
# → creates admin@aquatrack.gov.in / Admin@123

# 4. Start the server (serves both API and frontend)
npm start
```

Then open **http://localhost:5000** in your browser.

- Citizens: click **"Report a Water Issue"** to register and log in.
- Admin: click **"Department Login"**, use `admin@aquatrack.gov.in` / `Admin@123`.

For development with auto-restart on file changes:
```bash
npm run dev
```

### Changing the port or secret
Edit `backend/.env`:
```
PORT=5000
JWT_SECRET=change_this_to_something_random
```

---

## 6. API reference (for the project report)

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | public | citizen sign-up |
| POST | `/api/auth/login` | public | citizen/admin login, returns JWT |
| POST | `/api/complaints` | citizen | submit a complaint (multipart, with image) |
| GET | `/api/complaints/mine` | citizen | list own complaints |
| GET | `/api/complaints/:id` | citizen/admin | complaint detail + status history |
| GET | `/api/admin/complaints` | admin | list all, filter by `type`, `status`, `search` |
| GET | `/api/admin/staff` | admin | list field staff |
| POST | `/api/admin/staff` | admin | add a field staff member |
| PUT | `/api/admin/complaints/:id/assign` | admin | assign complaint to staff |
| PUT | `/api/admin/complaints/:id/status` | admin | update complaint status |
| GET | `/api/admin/stats` | admin | dashboard counts (by status / type) |

All protected routes require `Authorization: Bearer <token>`.

---

## 7. Suggested extensions (for higher marks / viva questions)

- Email/SMS notification to citizen on each status change (e.g. Nodemailer).
- Map view of all open complaints using Leaflet.js + the stored lat/long.
- Staff login role (separate from admin) so field staff can update their own
  assigned tickets directly.
- Complaint rating/feedback from citizens once a ticket is Closed.
- CSV/PDF export of complaint reports for department records.
- Rate limiting and CAPTCHA on registration to prevent spam complaints.

---

## 8. Default credentials created by the seed script

| Role | Email | Password |
|---|---|---|
| Admin | admin@aquatrack.gov.in | Admin@123 |

Sample field staff (Ravi Kumar, Sunita Reddy, Manohar Rao, Lakshmi Devi) are
also seeded so you can demo the "assign to staff" feature immediately.
=======
# CSP
>>>>>>> bcab41cedae1dab8fc01e5c513d236e8908ed929
