# TaskFlow Pro — Assumptions & Scope Boundaries

**ADL Issue:** ADLAAAA-2  
**RFP Reference:** MCG-2026-0042  
**Version:** 1.0  
**Date:** 2026-07-10  
**Status:** Draft — Pending Gate-1 Approval

Assumptions are classified as:
- **(minor)** — safe to proceed; no blocking question.
- **(product-critical)** — flagged for Delivery Director decision; marked where clarification has been obtained or a default has been applied.

---

## A-001 — No Email or SMS Delivery (minor)

**Assumption:** The RFP does not reference an email service provider or SMTP server. Notifications are **in-app only**. No SendGrid, SES, Mailgun, or any other external email/SMS provider will be integrated.

**Impact:** Users will not receive email alerts for task assignments, due-date reminders, or status changes. All notification delivery happens within the web UI.

**Mitigation:** The notification schema and service layer will be designed to allow email integration as a future extension without breaking changes.

---

## A-002 — File Storage on Local Volume (minor)

**Assumption:** Attached files (≤10 MB per file per FR-TM-006) are stored on a Docker-managed local volume. No AWS S3, GCS, Azure Blob, or other cloud object store is used.

**Impact:** File persistence depends on volume management in the Docker Compose deployment. Backup/restore of attachments is the operator's responsibility.

**Mitigation:** Volume name is declared in `docker-compose.yml` with a named volume so data survives container restarts.

---

## A-003 — Single-Tenant, On-Premises Deployment (minor)

**Assumption:** TaskFlow Pro is a single-tenant application deployed on-premises for Meridian Consulting Group. There is no multi-tenant SaaS model, namespace isolation between organisations, or per-tenant billing.

**Impact:** All users share one database and one deployment. Role-based access control (RBAC) enforces access within the single tenant.

---

## A-004 — No Third-Party Paid Services (hard constraint from RFP §5) (minor)

**Assumption:** As stated in RFP §5, no paid external services (analytics platforms, monitoring SaaS, feature-flag services, etc.) may be used. All dependencies must be open-source or self-hosted.

**Examples of excluded services:** Sentry (hosted), Datadog, Segment, LaunchDarkly, Mixpanel.

**Allowed:** Self-hosted Postgres, open-source libraries, Docker Hub images with permissive licences.

---

## A-005 — Notification Delivery via Polling (minor)

**Assumption:** In-app notification delivery will use server-side polling (client polls `/api/notifications` on a configurable interval, default 30 seconds) rather than WebSockets or Server-Sent Events. This satisfies the RFP requirement without additional real-time infrastructure complexity.

**Impact:** Notifications may arrive up to ~30 seconds after the triggering event.

**Mitigation:** The interval is configurable via an environment variable. If the client requires real-time delivery post-Gate-1, switching to SSE or WebSocket is an architecture-level decision.

---

## A-006 — Password Reset Flow (minor)

**Assumption:** Because no email delivery is in scope (A-001), self-service password reset via email link is **not implemented**. Password reset is an Admin action only: an Admin can set a new temporary password for a user. The user is prompted to change it on next login.

**Impact:** Users cannot self-serve password recovery without Admin assistance.

---

## A-007 — Avatar Storage on Local Volume (minor)

**Assumption:** User avatars (profile images) are stored on the same local Docker volume as task attachments. No CDN or image processing service is used.

**Impact:** Avatar images are served directly from the API. Large avatar uploads are not automatically resized (client should enforce reasonable size via file input; recommended max 2 MB for avatars, enforced by API).

---

## A-008 — Search Implementation via PostgreSQL Full-Text Search (minor)

**Assumption:** Global search (FR-SR-001) is implemented using PostgreSQL's native full-text search (`tsvector`/`tsquery`). No separate search engine (Elasticsearch, Meilisearch, Typesense) is deployed.

**Impact:** Search performance may degrade for very large datasets (millions of tasks/comments). Acceptable for the stated 500-concurrent-user scale target.

---

## A-009 — Browser Compatibility Scope (minor)

**Assumption:** "Latest 2 major versions" (NFR-008) means the two most recent stable releases at the time of delivery (July 2026). Internet Explorer and legacy Edge (EdgeHTML) are explicitly out of scope.

---

## A-010 — Due-in-24h Notification Logic (minor)

**Assumption:** The "due in 24 hours" notification (FR-NT-001) is checked by a scheduled background job running once per hour on the server. If a task's due date falls within the next 24 hours and no such notification has already been sent for that task in the current day, a notification is generated.

**Impact:** Notification may be delivered up to 1 hour late relative to the exact 24-hour mark.

---

## A-011 — Team Workload Chart — Open Tasks Definition (minor)

**Assumption:** The "team workload chart" (FR-ED-003) counts tasks with status **To Do**, **In Progress**, or **In Review** assigned to each user. Tasks with status **Done** are excluded from the workload count.

---

## A-012 — RAG Threshold Definition (minor)

**Assumption:** The overdue-percentage thresholds for project health (FR-ED-002) apply to tasks whose due date is in the past and whose status is not **Done**:
- **Green:** 0 overdue open tasks (0%)
- **Amber:** 1%–25% of open tasks are overdue
- **Red:** >25% of open tasks are overdue

If a project has no tasks, it defaults to **Green**.

---

## A-013 — Viewer Role and Project Visibility (minor)

**Assumption:** A Viewer can view projects and tasks only for projects they are explicitly added to as a member. They cannot browse the project list or discover projects they are not a member of.

---

## A-014 — Deployment Environment Variables (minor)

**Assumption:** Required environment variables (DB connection string, JWT secret, file upload path, etc.) are documented in a `.env.example` file committed to the repository. The operator copies this to `.env` and sets values before running `docker compose up --build`.

---

## A-015 — No Gantt, Time Tracking, or Recurring Tasks (minor)

**Assumption:** The following features are **out of scope** for this delivery:
- Gantt chart view
- Time tracking / time logging per task
- Recurring / repeating tasks
- Task dependencies (blocking/blocked-by links)

These are common project management features not mentioned in the RFP and are excluded to maintain scope discipline.

---

## A-016 — Single Assignee Per Task (minor)

**Assumption:** Each task has at most one assignee (FR-TM-001: "assignee (single user)"). Multiple-assignee tasks are not supported in this version.

---

## A-017 — Comment Editing (minor)

**Assumption:** Comment editing after submission is **not in scope**. Users may delete their own comments. This simplifies the activity log (no need to track comment edit history).

---

## Questions Escalated to Product / Client

None at this time. All RFP gaps have been resolved with minor assumptions above. If the Delivery Director identifies any assumption that requires client confirmation, it should be flagged before Gate-1 approval is granted.

---

*End of ASSUMPTIONS.md v1.0 — Pending Delivery Director Gate-1 approval*
