# TaskFlow Pro — Technical Architecture (RFP Deliverable 2)

**Client:** Meridian Consulting Group
**RFP Reference:** MCG-2026-0042
**ADL Issue:** ADLAAAA-4 (Gate 2 — Technical Architecture)
**Depends on:** `docs/PRD.md` (Gate-1 APPROVED), `docs/ASSUMPTIONS.md`
**Version:** 1.0
**Date:** 2026-07-11
**Status:** Draft — Pending Gate-2 (Delivery Director) approval

> Every decision below cites the PRD FR/NFR ID or ASSUMPTIONS ID that drives it. No coding tickets are created until this gate is approved.

---

## Table of Contents

1. [Stack & Rationale](#1-stack--rationale)
2. [System Topology](#2-system-topology)
3. [Database Schema (ERD + DDL)](#3-database-schema-erd--ddl)
4. [API Contract](#4-api-contract)
5. [Authentication & RBAC](#5-authentication--rbac)
6. [Folder Structure](#6-folder-structure)
7. [Cross-Cutting Concerns](#7-cross-cutting-concerns)
8. [NFR Compliance Strategy](#8-nfr-compliance-strategy)
9. [Docker Readiness](#9-docker-readiness)
10. [Traceability Matrix](#10-traceability-matrix)

---

## 1. Stack & Rationale

Honors RFP §5 hard constraints (PRD §1 "Tech constraints"). No paid third-party services (A-004).

| Layer | Choice | Rationale (1–2 lines) |
|-------|--------|-----------------------|
| Frontend | **Next.js 14 (App Router) + React 18 + TypeScript** | Mandated by RFP §5. App Router + Server Components meet page-load ≤2s (NFR-001); TanStack Query for client data/polling. |
| UI kit | **Tailwind CSS + shadcn/ui + dnd-kit** | Open-source (A-004). `dnd-kit` powers accessible Kanban drag-drop (FR-VW-001). No paid design system. |
| Backend | **NestJS 10 (Node 20, TypeScript) — REST** | Chosen over bare Express: built-in DI, Guards map 1:1 to RBAC (§4 matrix), `class-validator` Pipes give centralized input sanitization (NFR-005), and `@nestjs/swagger` auto-emits the OpenAPI spec (NFR-012, FR §5). Opinionated structure maximizes consistency across agent-built vertical slices. |
| ORM / DB access | **Prisma ORM** | Type-safe queries (prevents SQL injection by parameterization, NFR-005), first-class migrations (`prisma migrate`), and generated types shared with DTOs. |
| Database | **PostgreSQL 16** | Mandated by RFP §5. Native full-text search (`tsvector`) covers global search with no extra engine (A-008). |
| Auth | **JWT access + refresh (`@nestjs/jwt`, `bcrypt`)** | RFP §5 / NFR-004. bcrypt cost 12 (FR-UM-008, NFR-003). |
| API docs | **Swagger UI at `/api/docs`, JSON at `/api/docs-json`** | NFR-012, FR §5. |
| Scheduled jobs | **`@nestjs/schedule` (in-process cron)** | Hourly due-in-24h scan (A-010) — no external scheduler needed. |
| File storage | **Local Docker named volume via `multer` disk storage** | A-002 / A-007. No cloud object store. |
| Deployment | **Docker Compose (`web`, `api`, `db` services)** | NFR-011. `docker compose up --build`, env-only config (A-014). |
| Testing | **Jest (unit) + Supertest (API) + Playwright (E2E)** | All OSS; supports per-slice demonstrability. |

**Rejected options (for the record):** Express (less structure → higher agent-variance), Elasticsearch/Meilisearch (violates A-008 minimalism), S3/cloud storage (violates A-002), SSE/WebSocket for notifications (out of scope; polling per A-005).

---

## 2. System Topology

```
                     ┌───────────────────────────────────────────────┐
   Browser  ───────▶ │  web  (Next.js SSR/CSR, :3000)                 │
   (Chrome/FF/Edge)  │   - App Router pages, shadcn/ui                │
                     │   - TanStack Query (30s notif polling, A-005)  │
                     └───────────────┬───────────────────────────────┘
                                     │  REST/JSON over HTTP (JWT Bearer)
                                     ▼
                     ┌───────────────────────────────────────────────┐
                     │  api  (NestJS, :3001)                          │
                     │   Guards(JwtAuth → Roles → ProjectMember)      │
                     │   Modules: auth users projects tasks comments  │
                     │            attachments notifications dashboard │
                     │            search activity                     │
                     │   Cron: due-in-24h hourly (A-010)              │
                     │   Swagger at /api/docs (NFR-012)               │
                     └───────┬─────────────────────────┬─────────────┘
                             │ Prisma (parameterized)   │ multer disk
                             ▼                          ▼
                  ┌────────────────────┐    ┌────────────────────────┐
                  │ db  PostgreSQL 16  │    │ volume: uploads_data    │
                  │  (volume: pgdata)  │    │  /app/uploads (A-002/07)│
                  └────────────────────┘    └────────────────────────┘
```

All three services run under one `docker-compose.yml`. `web` proxies API calls; `api` is the only writer to Postgres and the uploads volume.

---

## 3. Database Schema (ERD + DDL)

### 3.1 ERD (relationships)

```
users ──1:N── projects (owner_id)
users ──M:N── projects              via project_members
projects ──1:N── tasks
tasks ──self 1:N── tasks            (parent_task_id, ONE level — FR-TM-004)
tasks ──1:N── task_comments
tasks ──1:N── task_attachments
users ──1:N── task_comments (author_id)
users ──1:N── task_attachments (uploaded_by)
tasks/projects ──1:N── activity_log
users ──1:N── notifications (recipient_id)
users ──1:N── refresh_tokens
task_comments ──M:N── users         via comment_mentions (@mention, FR-TM-005)
```

### 3.2 Enums

```sql
CREATE TYPE user_role       AS ENUM ('Admin','ProjectManager','Member','Viewer');   -- FR-UM-003
CREATE TYPE project_status  AS ENUM ('Planning','Active','OnHold','Completed');      -- FR-PM-002
CREATE TYPE task_priority   AS ENUM ('Low','Medium','High','Critical');              -- FR-TM-002
CREATE TYPE task_status     AS ENUM ('ToDo','InProgress','InReview','Done');         -- FR-TM-003
CREATE TYPE notification_type AS ENUM
  ('TaskAssigned','CommentMention','TaskDueSoon','TaskStatusChanged','CommentAdded'); -- FR-NT-001
CREATE TYPE activity_action AS ENUM
  ('StatusChanged','AssigneeChanged','CommentAdded','AttachmentAdded','DueDateChanged',
   'TaskCreated','TaskDeleted');                                                     -- FR-TM-007
```

### 3.3 DDL (migration-ready)

```sql
-- ============ users (FR-UM-001..009, NFR-003) ============
CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          CITEXT UNIQUE NOT NULL,                 -- case-insensitive unique
  password_hash  TEXT NOT NULL,                          -- bcrypt cost>=12 (FR-UM-008)
  full_name      VARCHAR(120) NOT NULL,
  role           user_role NOT NULL DEFAULT 'Member',    -- FR-UM-003
  department     VARCHAR(80),
  avatar_path    TEXT,                                   -- local volume path (A-007)
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,          -- FR-UM-005
  must_reset_pw  BOOLEAN NOT NULL DEFAULT FALSE,         -- admin-set temp pw (A-006)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_department ON users(department);

-- ============ projects (FR-PM-001..008) ============
CREATE TABLE projects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(160) NOT NULL,
  description  TEXT,
  status       project_status NOT NULL DEFAULT 'Planning', -- FR-PM-002
  owner_id     UUID NOT NULL REFERENCES users(id),         -- FR-PM-003
  start_date   DATE,
  end_date     DATE,
  is_archived  BOOLEAN NOT NULL DEFAULT FALSE,             -- FR-PM-004
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_archived ON projects(is_archived);

-- ============ project_members (M:N, FR-PM-005, A-013) ============
CREATE TABLE project_members (
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX idx_pm_user ON project_members(user_id);

-- ============ tasks (FR-TM-001..009) ============
CREATE TABLE tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_task_id  UUID REFERENCES tasks(id) ON DELETE CASCADE, -- 1-level subtask (FR-TM-004)
  title           VARCHAR(200) NOT NULL,                        -- required (FR-TM-001)
  description     TEXT,
  assignee_id     UUID REFERENCES users(id),                   -- single assignee (A-016)
  due_date        DATE,
  priority        task_priority NOT NULL DEFAULT 'Medium',      -- FR-TM-002
  status          task_status  NOT NULL DEFAULT 'ToDo',         -- FR-TM-003
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- enforce ONE level of nesting: a subtask's parent must itself be top-level.
  -- Guaranteed in service layer + trigger (see 3.4).
  CONSTRAINT chk_no_self_parent CHECK (parent_task_id <> id)
);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due ON tasks(due_date);
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);

-- ============ task_comments (FR-TM-005, A-017 no edit) ============
CREATE TABLE task_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES users(id),
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_comments_task ON task_comments(task_id);

-- @mention join (FR-TM-005 → triggers CommentMention notification)
CREATE TABLE comment_mentions (
  comment_id       UUID NOT NULL REFERENCES task_comments(id) ON DELETE CASCADE,
  mentioned_user   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (comment_id, mentioned_user)
);

-- ============ task_attachments (FR-TM-006, A-002, ≤10MB) ============
CREATE TABLE task_attachments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_name     VARCHAR(255) NOT NULL,
  storage_path  TEXT NOT NULL,                              -- path on uploads volume
  mime_type     VARCHAR(120) NOT NULL,
  size_bytes    INTEGER NOT NULL CHECK (size_bytes <= 10485760), -- 10MB (FR-TM-006)
  uploaded_by   UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_attach_task ON task_attachments(task_id);

-- ============ activity_log (FR-TM-007) ============
CREATE TABLE activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID REFERENCES tasks(id) ON DELETE CASCADE,
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  actor_id    UUID NOT NULL REFERENCES users(id),          -- who (FR-TM-007)
  action      activity_action NOT NULL,
  detail      JSONB,                                       -- {from,to} for changes
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()           -- when (FR-TM-007)
);
CREATE INDEX idx_activity_task ON activity_log(task_id, created_at DESC);

-- ============ notifications (FR-NT-001..006, A-005) ============
CREATE TABLE notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          notification_type NOT NULL,
  task_id       UUID REFERENCES tasks(id) ON DELETE CASCADE,
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  actor_id      UUID REFERENCES users(id),
  message       VARCHAR(500) NOT NULL,
  is_read       BOOLEAN NOT NULL DEFAULT FALSE,            -- FR-NT-002/003
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_recipient ON notifications(recipient_id, is_read, created_at DESC);
-- de-dup guard for hourly due-soon job (A-010): one TaskDueSoon per task per day
CREATE UNIQUE INDEX uq_notif_duesoon_day
  ON notifications(recipient_id, task_id, (created_at::date))
  WHERE type = 'TaskDueSoon';

-- ============ refresh_tokens (FR-UM-009, NFR-004) ============
CREATE TABLE refresh_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL,                              -- store hash, never raw (NFR-006)
  expires_at   TIMESTAMPTZ NOT NULL,                       -- ≤7d (NFR-004)
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rt_user ON refresh_tokens(user_id);
CREATE INDEX idx_rt_hash ON refresh_tokens(token_hash);

-- ============ full-text search (A-008, FR-SR-001) ============
ALTER TABLE tasks    ADD COLUMN search_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(title,'')||' '||coalesce(description,''))) STORED;
ALTER TABLE projects ADD COLUMN search_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(name,'')||' '||coalesce(description,''))) STORED;
ALTER TABLE task_comments ADD COLUMN search_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(body,''))) STORED;
CREATE INDEX idx_tasks_fts    ON tasks    USING GIN(search_tsv);
CREATE INDEX idx_projects_fts ON projects USING GIN(search_tsv);
CREATE INDEX idx_comments_fts ON task_comments USING GIN(search_tsv);
```

### 3.4 Integrity rules enforced in the service layer

- **One-level subtasks (FR-TM-004):** on subtask create, reject if `parent.parent_task_id IS NOT NULL`. Backed by a DB trigger as defense-in-depth.
- **Deactivated users (FR-UM-005):** login blocked when `is_active = false`; removed from active member listings but existing `assignee_id` retained (US-UM-03).
- **Archived projects (FR-PM-004):** all write endpoints reject mutations when `project.is_archived = true`.
- `CITEXT` requires `CREATE EXTENSION IF NOT EXISTS citext;` and `pgcrypto` for `gen_random_uuid()` — run in the initial migration.

---

## 4. API Contract

Base path `/api`. All JSON. OpenAPI served at `/api/docs` (NFR-012). Auth column: **Public**, or role(s) required; **member** = must be a member of the target project (A-013); **owner** = project owner/Admin.

### 4.1 Auth (FR-UM-001/002/009, NFR-004)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/register` | Public | Self-register (FR-UM-001) → returns access+refresh |
| POST | `/api/auth/login` | Public | Login (FR-UM-002); 401 if inactive (US-UM-03) |
| POST | `/api/auth/refresh` | Public+refresh cookie | Rotate access token (≤15m) using refresh (≤7d) |
| POST | `/api/auth/logout` | Auth | Revoke current refresh token |
| POST | `/api/auth/change-password` | Auth | Change pw; clears `must_reset_pw` (A-006) |

### 4.2 Users & Profile (FR-UM-004..007)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/users/me` | Auth | Current profile |
| PATCH | `/api/users/me` | Auth | Edit own name/department (FR-UM-007) |
| POST | `/api/users/me/avatar` | Auth | Upload avatar ≤2MB (A-007) |
| GET | `/api/users` | Admin/PM/Member | List users (Viewer ✗, §4 matrix); paginated |
| POST | `/api/users` | Admin | Create user (FR-UM-004) |
| PATCH | `/api/users/:id` | Admin | Edit role/department (FR-UM-003) |
| PATCH | `/api/users/:id/deactivate` | Admin | Deactivate (FR-UM-005) |
| PATCH | `/api/users/:id/reset-password` | Admin | Set temp pw (A-006) |

### 4.3 Projects & Members (FR-PM-001..008)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/projects` | member | List (paginated, sortable by name/status/date — FR-PM-008); excludes archived by default (FR-PM-004) |
| POST | `/api/projects` | Admin/PM | Create → status Planning (FR-PM-001) |
| GET | `/api/projects/:id` | member | Detail incl. progress % (FR-PM-006) |
| PATCH | `/api/projects/:id` | owner | Edit details (FR-PM-003) |
| DELETE | `/api/projects/:id` | Admin | Delete (§4: Admin only) |
| PATCH | `/api/projects/:id/status` | owner | Change status (FR-PM-007) |
| PATCH | `/api/projects/:id/archive` | owner | Archive/unarchive (FR-PM-004) |
| GET | `/api/projects/:id/members` | member | List members |
| POST | `/api/projects/:id/members` | owner | Add member (FR-PM-005) |
| DELETE | `/api/projects/:id/members/:userId` | owner | Remove member |

### 4.4 Tasks & Subtasks (FR-TM-001..009)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/projects/:id/tasks` | member | List tasks; filters status/priority/assignee/due; drives Kanban/List/Calendar (FR-VW-001/002/003) |
| POST | `/api/projects/:id/tasks` | member (not Viewer) | Create task → ToDo (FR-TM-001/008) |
| GET | `/api/tasks/:id` | member | Task detail (+subtasks, comments, attachments, activity) |
| PATCH | `/api/tasks/:id` | member/assignee | Edit fields (FR-TM-008); RBAC per §4 |
| PATCH | `/api/tasks/:id/status` | member/assignee | Status change → activity + notif (FR-TM-009, FR-VW-001) |
| DELETE | `/api/tasks/:id` | Admin/PM | Delete task |
| POST | `/api/tasks/:id/subtasks` | member | Add 1-level subtask (FR-TM-004) |
| GET | `/api/tasks/mine` | Auth | My Tasks across projects, due-date asc (FR-VW-004, US-VW-03) |

### 4.5 Comments / Attachments / Activity (FR-TM-005/006/007)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/tasks/:id/comments` | member | List comments |
| POST | `/api/tasks/:id/comments` | member | Add comment + parse @mentions → notif (FR-TM-005) |
| DELETE | `/api/comments/:id` | own / PM / Admin | Delete (§4 matrix; A-017 no edit) |
| GET | `/api/tasks/:id/attachments` | member | List attachments |
| POST | `/api/tasks/:id/attachments` | member | Upload ≤10MB (FR-TM-006) |
| GET | `/api/attachments/:id/download` | member | Download from volume (A-002) |
| DELETE | `/api/attachments/:id` | own / PM / Admin | Delete attachment |
| GET | `/api/tasks/:id/activity` | member | Activity log, reverse-chron (FR-TM-007, US-TM-06) |

### 4.6 Notifications (FR-NT-001..006, A-005)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/notifications` | Auth | Paginated, 50 recent default (FR-NT-006); polled every 30s (A-005) |
| GET | `/api/notifications/unread-count` | Auth | Bell badge count (FR-NT-002) |
| PATCH | `/api/notifications/:id/read` | Auth | Mark one read (FR-NT-003) |
| PATCH | `/api/notifications/read-all` | Auth | Mark all read (FR-NT-004) |

### 4.7 Dashboard & Search (FR-ED-001..006, FR-SR-001..004)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/dashboard/summary` | Admin/PM | KPIs: active projects, overdue, done-this-week (FR-ED-001); dept+date filters (FR-ED-004) |
| GET | `/api/dashboard/project-health` | Admin/PM | RAG per project (FR-ED-002, A-012) |
| GET | `/api/dashboard/workload` | Admin/PM | Open-task count per member (FR-ED-003, A-011) |
| GET | `/api/search` | member scope | FTS across projects/tasks/comments (FR-SR-001/003); filters assignee/status/priority/due (FR-SR-002); links to entity (FR-SR-004) |

**Dashboard is Admin/PM only (FR-ED-006)** — enforced by `@Roles('Admin','ProjectManager')` guard.

### 4.8 Conventions

- **Errors:** RFC-7807-style `{ statusCode, error, message, details? }`. 400 validation, 401 unauth, 403 RBAC, 404, 409 conflict (dup email), 413 payload too large (>10MB).
- **Pagination:** `?page=1&pageSize=20&sort=field:asc`; responses wrap `{ data, page, pageSize, total }`.
- **Versioning:** all under `/api`; breaking changes would move to `/api/v2` (not needed for v1).

---

## 5. Authentication & RBAC

**Token flow (FR-UM-009, NFR-004):**
1. `login`/`register` → **access JWT** (TTL 15m, `JWT_ACCESS_TTL`) in the JSON body + **refresh JWT** (TTL 7d, `JWT_REFRESH_TTL`) set as an `httpOnly`, `Secure`, `SameSite=Strict` cookie.
2. Client sends `Authorization: Bearer <access>` on every call.
3. On 401, client calls `/api/auth/refresh`; server verifies the refresh token against the **hashed** row in `refresh_tokens`, rotates it (revoke old, issue new), returns a fresh access token.
4. `logout` revokes the refresh row. Refresh tokens are stored **hashed** (SHA-256) — raw tokens are never persisted or logged (NFR-006).

**RBAC enforcement (PRD §4 matrix)** — layered NestJS Guards run in order:
1. `JwtAuthGuard` — validates access token, loads `req.user` (id, role, active). Rejects inactive users (FR-UM-005).
2. `RolesGuard` — reads `@Roles(...)` metadata; enforces the global role (Admin/PM/Member/Viewer).
3. `ProjectMemberGuard` — for project-scoped routes, confirms membership (A-013) and derives effective permission (`owner` vs `member` vs `assignee`) for row-level checks (e.g. Team Member may edit only own/assigned tasks — §4 Task Management).

Password hashing: bcrypt cost factor **12** (`BCRYPT_COST=12`, FR-UM-008, NFR-003).

---

## 6. Folder Structure

Monorepo. Vertical slices touch `frontend/` + `backend/` together; each slice is independently demonstrable (see `SLICE-PLAN.md`).

```
TaskFlow-Pro/
├── docker-compose.yml            # web + api + db, named volumes (NFR-011)
├── .env.example                  # documented env vars (A-014)
├── README.md                     # run instructions: docker compose up --build
├── AGENTS.md                     # scaffolding/conventions standard (see §6.1)
├── docs/                         # PRD, ASSUMPTIONS, ARCHITECTURE, WIREFRAMES, SLICE-PLAN
├── db/
│   └── migrations/               # Prisma migration SQL (source of §3 DDL)
├── backend/                      # NestJS
│   ├── Dockerfile
│   ├── prisma/schema.prisma
│   ├── src/
│   │   ├── main.ts               # bootstrap + Swagger setup
│   │   ├── app.module.ts
│   │   ├── common/               # guards, pipes, filters, interceptors (cross-cutting §7)
│   │   │   ├── guards/           # jwt-auth, roles, project-member
│   │   │   ├── pipes/            # ValidationPipe config, sanitization
│   │   │   └── filters/          # global exception → RFC-7807
│   │   └── modules/
│   │       ├── auth/
│   │       ├── users/
│   │       ├── projects/
│   │       ├── tasks/
│   │       ├── comments/
│   │       ├── attachments/
│   │       ├── notifications/    # incl. due-soon cron (A-010)
│   │       ├── activity/
│   │       ├── dashboard/
│   │       └── search/
│   └── test/                     # jest + supertest
└── frontend/                     # Next.js (App Router)
    ├── Dockerfile
    ├── src/
    │   ├── app/                  # routes: (auth)/, dashboard/, projects/[id]/, my-tasks/, admin/, profile/, search/
    │   ├── components/           # ui/ (shadcn), kanban/, calendar/, notifications/
    │   ├── lib/                  # api client, auth context, query hooks
    │   └── styles/
    └── test/                     # playwright E2E
```

Each backend module follows the same shape: `*.controller.ts`, `*.service.ts`, `*.module.ts`, `dto/`, `entities/` — this uniformity is the highest-leverage input for consistent agent output.

### 6.1 `AGENTS.md` template (scaffolding standard — explicit deliverable)

The repo root `AGENTS.md` will be seeded (by the first scaffolding slice) with:

```markdown
# TaskFlow Pro — Engineering Conventions (AGENTS.md)

## Golden rules
- Every commit references its Paperclip issue id (e.g. `feat(tasks): ... (ADLAAAA-N)`).
- One vertical slice per issue: DB + API + UI + test, independently demonstrable.
- App must always run with `docker compose up --build`.

## Backend (NestJS)
- One module per resource under `src/modules/<resource>/`.
- Controllers thin; business logic in services; DB access via Prisma only.
- Every DTO uses class-validator; every write route sanitizes input (§7).
- Every route decorated with @ApiOperation + @Roles(...) — Swagger + RBAC are not optional.
- Never log tokens, passwords, or PII (NFR-006).

## Frontend (Next.js)
- App Router; server components for reads, client components for interactivity.
- API access via `lib/api` client only; auth token in memory + refresh cookie.
- TanStack Query for server state; 30s polling for notifications.

## Naming & style
- TypeScript strict; ESLint + Prettier enforced in CI.
- snake_case in DB, camelCase in TS DTOs (Prisma maps).
- Enum values match §3.2 exactly.

## Testing
- Each slice ships ≥1 supertest API test + ≥1 Playwright happy-path.
- PRs green on lint + unit + e2e before review.

## Definition of Done (per slice)
- Traces to FR/NFR IDs; Swagger updated; migration committed; demoable in the running stack.
```

---

## 7. Cross-Cutting Concerns

| Concern | Approach | Trace |
|---------|----------|-------|
| **Input validation & sanitization** | Global `ValidationPipe({whitelist, forbidNonWhitelisted, transform})` + `class-validator` DTOs on every route. HTML in free-text (comments/descriptions) sanitized server-side (`sanitize-html`) before persist; React escapes on render. Prisma parameterizes → no SQL injection. | NFR-005, US-* |
| **No secrets in logs** | Structured logger (`pino`) with a redaction list (`authorization`, `password`, `token`, `refresh`). Request logger omits bodies on auth routes. Refresh tokens stored hashed. | NFR-006 |
| **File upload handling** | `multer` disk storage to `UPLOAD_DIR` on the `uploads_data` volume; reject >10MB (attachments) / >2MB (avatars) via limits; validate MIME allowlist; random stored filename, original kept in DB; downloads streamed with auth + membership check. | FR-TM-006, A-002/A-007 |
| **Notification triggers** | Emitted in the owning service on: task **assigned** (create/reassign), **comment added** (+@mention), **status changed** (owner+assignee), and **due-in-24h** hourly cron (A-010, de-dup via unique index). Central `NotificationsService.emit()`. | FR-NT-001, US-NT-01 |
| **Pagination** | Standard `page/pageSize` on all list endpoints (projects, users, tasks, notifications, search). Keeps payloads small for NFR-001/002. | FR-PM-008, FR-NT-006 |
| **Activity logging** | `ActivityService.record()` called in the same transaction as the mutating change → consistency. | FR-TM-007 |
| **Progress & RAG compute** | Progress % = round(Done/total×100) (FR-PM-006, US-PM-03); RAG per A-012; workload per A-011 — computed in SQL aggregates, not N+1. | FR-PM-006, FR-ED-002/003 |
| **CORS / headers** | `helmet`, CORS restricted to the `web` origin, rate-limit on auth routes. | NFR-005 |

---

## 8. NFR Compliance Strategy

| NFR | Target | How met |
|-----|--------|---------|
| NFR-001 | Page load ≤2s (P95) | Next.js SSR + code-splitting; TanStack Query caching; paginated lists. |
| NFR-002 | API ≤500ms (P95) | Indexed queries (§3.3), SQL aggregates for dashboard, GIN for search, no N+1 (Prisma `include` batching). |
| NFR-003 | bcrypt cost ≥12 | `BCRYPT_COST=12`. |
| NFR-004 | JWT ≤15m / refresh ≤7d | Enforced TTLs, rotation, revoke on logout. |
| NFR-005 | Input sanitized, no XSS/SQLi | ValidationPipe + sanitize-html + Prisma parameterization + React escaping + helmet. |
| NFR-006 | No secrets in logs | pino redaction; hashed refresh tokens. |
| NFR-007 | 500 concurrent users | Stateless API (horizontally scalable), DB connection pooling (Prisma pool), no in-memory session; Compose can scale `api` replicas. |
| NFR-008/009 | Browser + responsive | Tailwind responsive breakpoints ≥768px/≥1280px; target latest-2 Chrome/FF/Edge (A-009). |
| NFR-010 | 99.5% uptime | Container `restart: unless-stopped`, DB healthchecks, stateless API. |
| NFR-011 | `docker compose up --build` | §9. |
| NFR-012 | OpenAPI | Swagger at `/api/docs`. |

---

## 9. Docker Readiness

Every service has a clear containerization story achievable with `docker compose up --build` (NFR-011, no manual steps beyond env vars — A-014):

```
services:
  db:    postgres:16-alpine   — volume pgdata, healthcheck pg_isready, env from .env
  api:   build ./backend      — depends_on db (healthy); runs `prisma migrate deploy` on start
                                then boots Nest; mounts uploads_data volume; exposes 3001
  web:   build ./frontend     — depends_on api; Next.js production build; exposes 3000
volumes: pgdata, uploads_data
```

- **Migrations auto-apply** on `api` start (`prisma migrate deploy`) — no manual DB step.
- **`.env.example`** (A-014) documents: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL=15m`, `JWT_REFRESH_TTL=7d`, `BCRYPT_COST=12`, `UPLOAD_DIR=/app/uploads`, `MAX_UPLOAD_MB=10`, `NOTIF_POLL_SECONDS=30`, `DUE_SOON_CRON=0 * * * *`.
- Named volumes (`pgdata`, `uploads_data`) persist DB + files across restarts (A-002/A-007).
- Optional `seed` step (idempotent) creates a first Admin so the app is demoable immediately.

The concrete `docker-compose.yml`, Dockerfiles, and `.env.example` are produced in the **final Docker/README slice** (see `SLICE-PLAN.md`) — not now, per the "no coding/scaffold" constraint.

---

## 10. Traceability Matrix

| FR/NFR | Covered by (this doc) |
|--------|-----------------------|
| FR-UM-001..009 | §3 users/refresh_tokens, §4.1/4.2, §5 |
| FR-PM-001..008 | §3 projects/project_members, §4.3, §7 progress |
| FR-TM-001..009 | §3 tasks/comments/attachments/activity, §4.4/4.5 |
| FR-VW-001..005 | §4.4 (task lists drive Kanban/List/Calendar/My Tasks); view-pref stored client-side (FR-VW-005) |
| FR-NT-001..006 | §3 notifications, §4.6, §7 triggers, A-005/A-010 |
| FR-ED-001..006 | §3 aggregates, §4.7, §7 RAG/workload |
| FR-SR-001..004 | §3 FTS, §4.7, A-008 |
| NFR-001..012 | §8, §9 |

> **Note on FR-VW-005** (remember last active view): stored as a browser/localStorage user preference on the frontend; no server table required, matching the PRD wording ("stored in the browser / user preference").

---

*End of ARCHITECTURE.md v1.0 — Pending Gate-2 (Delivery Director) approval.*
