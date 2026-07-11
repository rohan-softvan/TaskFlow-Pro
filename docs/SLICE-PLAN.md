# TaskFlow Pro — Vertical Slice Plan (Gate 2)

**Client:** Meridian Consulting Group
**RFP Reference:** MCG-2026-0042
**ADL Issue:** ADLAAAA-4 (Gate 2)
**Depends on:** `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/WIREFRAMES.md`
**Version:** 1.0
**Date:** 2026-07-11
**Status:** Draft — Pending Gate-2 (Delivery Director) approval

> Proposed, dependency-ordered list of **thin, end-to-end vertical slices**. PM/Issue Factory turns each into one coding ticket **after** Gate-2 approval. Each slice is independently demonstrable in the running stack (`docker compose up --build`) and ships DB migration + API + UI + ≥1 API test + ≥1 E2E happy-path per `AGENTS.md`. Every slice traces to PRD FR/NFR IDs.

---

## Principles

- **Vertical, not horizontal:** each slice cuts DB → API → UI so it can be demoed alone (ADL vertical-slice rule).
- **Dependency-ordered:** auth → users/RBAC → projects → tasks → views → notifications → dashboard → search → docker/README.
- **Scaffolding first:** Slice 0 establishes the monorepo shape and `AGENTS.md` so all later slices are consistent.
- **Docker stays green from Slice 0:** the stack must build & boot after every slice, never only at the end (NFR-011).

---

## Slices

### Slice 0 — Project Scaffold & Docker Skeleton
- **Delivers:** Monorepo per ARCHITECTURE §6 (`frontend/`, `backend/`, `db/`), root `AGENTS.md` (§6.1), `docker-compose.yml` with `web`+`api`+`db`, `.env.example`, empty NestJS boot + Swagger at `/api/docs`, Next.js landing page, Postgres with Prisma + `citext`/`pgcrypto` extensions. `prisma migrate deploy` on api start.
- **Demo:** `docker compose up --build` → web on :3000, Swagger on :3001/api/docs, db healthy.
- **Traces:** NFR-011, NFR-012; ARCHITECTURE §6/§9.
- **Depends on:** — (first slice).

### Slice 1 — Auth: Register / Login / JWT + Refresh
- **Delivers:** `users` + `refresh_tokens` tables; `POST /auth/register|login|refresh|logout`; bcrypt cost 12; access (15m) + refresh (7d, httpOnly cookie, hashed at rest, rotation); Login/Register UI (Wireframe 1); auth context + API client on frontend.
- **Demo:** register → land on app; token auto-refreshes; logout revokes.
- **Traces:** FR-UM-001/002/008/009, NFR-003/004/006; US-UM-01.
- **Depends on:** 0.

### Slice 2 — RBAC Guards & Admin User Management
- **Delivers:** role enum + `JwtAuthGuard`/`RolesGuard`; inactive-user login block; `GET/POST/PATCH /users`, deactivate, reset-password (temp/must_reset_pw); Admin Users screen (Wireframe 11); forced change-password flow.
- **Demo:** Admin creates a Member, deactivates them → login 401; Member can't reach admin routes (403).
- **Traces:** FR-UM-003/004/005, §4 matrix; US-UM-02/03, A-006.
- **Depends on:** 1.

### Slice 3 — Profile & Avatar Upload
- **Delivers:** `GET/PATCH /users/me`, `POST /users/me/avatar` (≤2MB to uploads volume); Profile screen (Wireframe 12); avatar surfaces in header.
- **Demo:** edit name/department; upload avatar → appears in header.
- **Traces:** FR-UM-006/007, A-007; US-UM-04.
- **Depends on:** 2. *(Establishes the file-upload/volume pattern reused by Slice 8.)*

### Slice 4 — Projects CRUD + Members + `ProjectMemberGuard`
- **Delivers:** `projects` + `project_members`; project CRUD, status change, archive, add/remove members; `ProjectMemberGuard` (membership + owner checks); Project List + Project Detail header (Wireframes 3–4, minus task views).
- **Demo:** PM creates project (Planning), adds members, changes status, archives (read-only); non-member gets 403.
- **Traces:** FR-PM-001/002/003/004/005/007/008, §4; US-PM-01/02.
- **Depends on:** 2.

### Slice 5 — Tasks CRUD + Activity Log + Progress %
- **Delivers:** `tasks` + `activity_log`; task CRUD, status/assignee/due edits with per-field row-level RBAC (own/assigned for Member); activity recorded in same transaction; project progress % (Done/total). Task Detail core + activity section (Wireframe 8, minus subtasks/comments/attachments).
- **Demo:** create task (To Do), change status → activity entry appended; project progress recalculates.
- **Traces:** FR-TM-001/002/003/007/008, FR-PM-006; US-TM-01/06, US-PM-03.
- **Depends on:** 4.

### Slice 6 — Subtasks (one level) + Comments + @mentions
- **Delivers:** `task_comments` + `comment_mentions`; one-level subtask create (guard + trigger); comments with @mention autocomplete (project members); Task Detail subtasks + comments sections (Wireframe 8). Emits the `CommentMention` notification event (consumed by Slice 9).
- **Demo:** add subtask (no deeper nesting offered); comment with @mention persists and records mention.
- **Traces:** FR-TM-004/005; US-TM-03/04, A-017.
- **Depends on:** 5.

### Slice 7 — Task Views: Kanban + List + Calendar + My Tasks
- **Delivers:** task-list filters (status/priority/assignee/due) driving all views; Kanban drag-drop status update (dnd-kit); List sortable + inline status; Calendar by due date; My Tasks cross-project (due asc); per-user last-view preference in browser storage (Wireframes 5–7, 9).
- **Demo:** drag a Kanban card → status updates + activity; My Tasks lists cross-project assignments.
- **Traces:** FR-VW-001/002/003/004/005, FR-TM-009; US-VW-01/02/03, US-TM-02.
- **Depends on:** 5 *(6 optional but preferred for full Task Detail).*

### Slice 8 — Task Attachments (≤10MB)
- **Delivers:** `task_attachments`; upload (multer disk, ≤10MB, MIME allowlist) to uploads volume, list, auth'd streamed download, delete (own/PM/Admin); Task Detail attachments section (Wireframe 8).
- **Demo:** upload ≤10MB → listed + downloadable; >10MB rejected (413).
- **Traces:** FR-TM-006, A-002/A-007; US-TM-05.
- **Depends on:** 5 *(reuses upload pattern from Slice 3).*

### Slice 9 — Notifications (triggers + panel + due-soon cron)
- **Delivers:** `notifications`; central `NotificationsService.emit()` wired to assigned / comment+@mention / status-change; hourly due-in-24h cron with per-day de-dup; bell badge + panel with mark-read / mark-all-read; 30s polling (Wireframe 10).
- **Demo:** assign a task / @mention / change status → recipient's bell increments; mark read clears it.
- **Traces:** FR-NT-001/002/003/004/005/006, A-005/A-010; US-NT-01/02.
- **Depends on:** 6, 7 *(needs assignment, comments, status events).*

### Slice 10 — Executive Dashboard (KPIs + RAG + Workload)
- **Delivers:** `/dashboard/summary|project-health|workload` (SQL aggregates, no N+1); KPI tiles, RAG per project, workload chart, department + date filters, manual refresh; Admin/PM-only guard (Wireframe 2).
- **Demo:** dashboard shows active/overdue/done-this-week, RAG colors, workload bars; filters re-query; Member gets 403.
- **Traces:** FR-ED-001/002/003/004/005/006, A-011/A-012; US-ED-01/02.
- **Depends on:** 5 *(tasks/projects data), 4.*

### Slice 11 — Global Search (FTS, scoped, filterable)
- **Delivers:** Postgres `tsvector` GIN search across projects/tasks/comments; results scoped to member projects (no leakage); filters (assignee/status/priority/due); result grouping + direct links; header search overlay (Wireframe 13).
- **Demo:** search term returns scoped projects/tasks/comments; filter narrows; result click navigates.
- **Traces:** FR-SR-001/002/003/004, A-008; US-SR-01.
- **Depends on:** 6 *(comments), 5, 4.*

### Slice 12 — Delivery Hardening: README, Seed, Compose finalize, E2E
- **Delivers:** finalized `docker-compose.yml` (healthchecks, `restart: unless-stopped`, volumes), idempotent seed (first Admin), `README.md` run instructions, helmet/CORS/rate-limit on auth, pino redaction verified, Playwright happy-path suite across core flows, OpenAPI completeness check.
- **Demo:** clean checkout → `docker compose up --build` → seeded Admin logs in and exercises every feature; Swagger complete.
- **Traces:** NFR-005/006/007/010/011/012; ARCHITECTURE §9.
- **Depends on:** all prior.

---

## Dependency Graph

```
0 ─▶ 1 ─▶ 2 ─┬─▶ 3 ─────────────┐
             ├─▶ 4 ─▶ 5 ─┬─▶ 6 ─┼─▶ 9 ─┐
             │           ├─▶ 7 ──┘      ├─▶ 12
             │           ├─▶ 8 ─────────┤
             │           ├─▶ 10 ────────┤
             │           └─▶ 11 ────────┘
```

- **Critical path:** 0 → 1 → 2 → 4 → 5 → 6 → 9 → 12.
- **Parallelizable after Slice 5:** 7 (views), 8 (attachments), 10 (dashboard), 11 (search) can proceed concurrently by different coding agents once tasks exist.

## Coverage Check (every FR area lands in a slice)

| FR area | Slice(s) |
|---------|----------|
| FR-UM (users/auth/profile) | 1, 2, 3 |
| FR-PM (projects) | 4 |
| FR-TM (tasks/subtasks/comments/attachments/activity) | 5, 6, 8 |
| FR-VW (views) | 7 |
| FR-NT (notifications) | 9 |
| FR-ED (dashboard) | 10 |
| FR-SR (search) | 11 |
| NFR / Docker / delivery | 0, 12 (cross-cutting throughout) |

---

*End of SLICE-PLAN.md v1.0 — 13 slices (0–12). Pending Gate-2 (Delivery Director) approval; PM/Issue Factory creates coding tickets only after approval.*
