# TaskFlow Pro — Product Requirements Document (PRD)

**Client:** Meridian Consulting Group  
**RFP Reference:** MCG-2026-0042  
**ADL Issue:** ADLAAAA-2  
**Gate:** 1 — Product Spec (awaiting Delivery Director approval before Architecture)  
**Version:** 1.0  
**Date:** 2026-07-10  
**Status:** Draft — Pending Gate-1 Approval

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Functional Requirements](#2-functional-requirements)
3. [Non-Functional Requirements](#3-non-functional-requirements)
4. [Role × Permission Matrix](#4-role--permission-matrix)
5. [User Stories & Acceptance Criteria](#5-user-stories--acceptance-criteria)
6. [Scope Boundaries & Assumptions](#6-scope-boundaries--assumptions)
7. [Requirements Traceability](#7-requirements-traceability)

---

## 1. Product Overview

TaskFlow Pro is a team task and project management platform for Meridian Consulting Group. It provides project lifecycle management, task tracking with priority and status workflows, multiple views (Kanban, List, Calendar, My Tasks), an executive dashboard, in-app notifications, and global search. The system is deployed on-premises via Docker Compose with a Next.js frontend, REST API backend, and PostgreSQL database.

**Tech constraints (hard — RFP §5):**
- Frontend: Next.js
- Backend: REST API with OpenAPI/Swagger documentation
- Database: PostgreSQL
- Auth: JWT + refresh tokens
- Deployment: Docker Compose
- No third-party paid services
- Source on GitHub: `https://github.com/rohan-softvan/TaskFlow-Pro`

---

## 2. Functional Requirements

### 2.1 User Management

| ID | Requirement |
|----|-------------|
| FR-UM-001 | Users shall register with email and password. |
| FR-UM-002 | Users shall log in with email and password. |
| FR-UM-003 | The system shall support four roles: **Admin**, **Project Manager**, **Team Member**, **Viewer**. |
| FR-UM-004 | Admins shall create new user accounts (setting name, email, role, department). |
| FR-UM-005 | Admins shall deactivate user accounts. Deactivated users cannot log in and are removed from active project member lists. |
| FR-UM-006 | Each user shall have a profile containing: full name, avatar (image upload), department. |
| FR-UM-007 | Users shall be able to edit their own profile (name, avatar, department). |
| FR-UM-008 | Passwords shall be stored using bcrypt hashing with a minimum cost factor of 12. |
| FR-UM-009 | The system shall issue JWT access tokens (short-lived, ≤15 min) and refresh tokens (longer-lived, ≤7 days). |

### 2.2 Project Management

| ID | Requirement |
|----|-------------|
| FR-PM-001 | Users with sufficient role shall create projects with a name, description, and optional start/end dates. |
| FR-PM-002 | Projects shall have one of four statuses: **Planning**, **Active**, **On Hold**, **Completed**. |
| FR-PM-003 | Project owners (Admin or PM) shall update and delete projects. |
| FR-PM-004 | Project owners shall archive projects. Archived projects are read-only and hidden from default views. |
| FR-PM-005 | Multiple members (any mix of roles) shall be assignable to a project. |
| FR-PM-006 | The system shall compute and display a percentage-progress figure per project, derived from the ratio of Done tasks to total tasks. |
| FR-PM-007 | Admins and PMs shall change a project's status. |
| FR-PM-008 | Project list shall be paginated and sortable by name, status, and date. |

### 2.3 Task Management

| ID | Requirement |
|----|-------------|
| FR-TM-001 | Tasks shall have: title (required), description, assignee (single user), due date, priority, status. |
| FR-TM-002 | Task priority shall be one of: **Low**, **Medium**, **High**, **Critical**. |
| FR-TM-003 | Task status shall be one of: **To Do**, **In Progress**, **In Review**, **Done**. |
| FR-TM-004 | Tasks shall support one level of subtasks. Subtasks share the same fields as tasks (except they cannot themselves have subtasks). |
| FR-TM-005 | Users shall add comments to tasks. Comments shall support @mention of project members, which triggers a notification to the mentioned user. |
| FR-TM-006 | Users shall attach files to tasks. Maximum attachment size per file: 10 MB. Files are stored on the local volume (see ASSUMPTIONS.md A-004). |
| FR-TM-007 | The system shall maintain an activity log per task recording: status changes, assignee changes, comment additions, attachment additions, due-date changes. Each log entry records the actor and timestamp. |
| FR-TM-008 | Authorized users shall create, edit, and delete tasks within a project. |
| FR-TM-009 | Task status may be updated by drag-and-drop on the Kanban view or inline edit in List/Calendar views. |

### 2.4 Views

| ID | Requirement |
|----|-------------|
| FR-VW-001 | **Kanban View** — display tasks as cards in columns corresponding to each task status. Users shall drag and drop cards between columns to update status. |
| FR-VW-002 | **List View** — display tasks in a tabular/list layout sortable by any task field (status, priority, due date, assignee). |
| FR-VW-003 | **Calendar View** — display tasks on a monthly calendar by due date. Users shall click a date/task to open the task detail. |
| FR-VW-004 | **My Tasks View** — display all tasks assigned to the currently authenticated user, across all projects they belong to. |
| FR-VW-005 | Views shall persist the selected project context and remember the last active view per user (stored in the browser / user preference). |

### 2.5 Notifications

| ID | Requirement |
|----|-------------|
| FR-NT-001 | The system shall generate in-app notifications for: task assigned to user, comment added on a task the user owns or follows, task due in 24 hours, task status changed (for task owner and assignee). |
| FR-NT-002 | A bell icon in the global header shall display the count of unread notifications. |
| FR-NT-003 | Users shall mark individual notifications as read. |
| FR-NT-004 | Users shall mark all notifications as read in one action. |
| FR-NT-005 | Notifications are in-app only; no email or SMS delivery (see ASSUMPTIONS.md A-001). |
| FR-NT-006 | The notification list shall show the most recent 50 notifications; older notifications are accessible via pagination or "load more". |

### 2.6 Executive Dashboard

| ID | Requirement |
|----|-------------|
| FR-ED-001 | The dashboard shall display: count of active projects, count of overdue tasks, count of tasks completed this week. |
| FR-ED-002 | Each project shall show a health indicator — **Green** (0% overdue), **Amber** (1–25% overdue), **Red** (>25% overdue) — based on the ratio of overdue tasks to total open tasks in the project. |
| FR-ED-003 | The dashboard shall display a team workload chart showing the number of open tasks assigned to each team member. |
| FR-ED-004 | The dashboard shall support filtering by department and date range. |
| FR-ED-005 | Dashboard data shall refresh on page load; a manual refresh action shall also be available. |
| FR-ED-006 | The dashboard is accessible to Admin and Project Manager roles only. |

### 2.7 Search

| ID | Requirement |
|----|-------------|
| FR-SR-001 | A global search bar shall search across: project names/descriptions, task titles/descriptions, and task comments. |
| FR-SR-002 | Search results shall be filterable by: assignee, task status, task priority, due date range. |
| FR-SR-003 | Search shall return results within the projects the authenticated user is a member of (no cross-boundary leakage). |
| FR-SR-004 | Search results shall link directly to the matching project or task. |

---

## 3. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-001 | Performance | Page load time ≤ 2 seconds (P95) under normal load. |
| NFR-002 | Performance | REST API response time ≤ 500 ms (P95) under normal load. |
| NFR-003 | Security | Passwords stored with bcrypt (min cost factor 12). |
| NFR-004 | Security | Authentication via JWT access tokens (≤15 min TTL) + refresh tokens (≤7 days TTL). |
| NFR-005 | Security | All user-supplied input sanitized before persistence and rendering (prevent XSS, SQL injection). |
| NFR-006 | Security | No secrets, tokens, or PII logged in application logs. |
| NFR-007 | Scalability | System shall support 500 concurrent users without degradation. |
| NFR-008 | Browser support | Fully functional on Chrome, Firefox, and Edge (latest 2 major versions each). |
| NFR-009 | Responsiveness | UI shall be responsive and usable on desktop (≥1280px) and tablet (768px–1279px) screen widths. |
| NFR-010 | Availability | System uptime target: 99.5% (measured monthly). |
| NFR-011 | Deployment | System must be launchable with `docker compose up --build` with no manual steps beyond setting env vars. |
| NFR-012 | API docs | REST API must expose an OpenAPI (Swagger) specification accessible at a documented path. |

---

## 4. Role × Permission Matrix

`✓` = allowed, `✗` = not allowed, `own` = only own records, `member` = only for projects the user is a member of.

### User Management

| Action | Admin | Project Manager | Team Member | Viewer |
|--------|-------|-----------------|-------------|--------|
| Register / login | ✓ | ✓ | ✓ | ✓ |
| View own profile | ✓ | ✓ | ✓ | ✓ |
| Edit own profile | ✓ | ✓ | ✓ | ✓ |
| View other user profiles | ✓ | ✓ | ✓ | ✗ |
| Create users | ✓ | ✗ | ✗ | ✗ |
| Deactivate users | ✓ | ✗ | ✗ | ✗ |
| Change user roles | ✓ | ✗ | ✗ | ✗ |

### Project Management

| Action | Admin | Project Manager | Team Member | Viewer |
|--------|-------|-----------------|-------------|--------|
| Create project | ✓ | ✓ | ✗ | ✗ |
| View projects (member) | ✓ | member | member | member |
| Edit project details | ✓ | member (own) | ✗ | ✗ |
| Change project status | ✓ | member (own) | ✗ | ✗ |
| Add / remove members | ✓ | member (own) | ✗ | ✗ |
| Archive project | ✓ | member (own) | ✗ | ✗ |
| Delete project | ✓ | ✗ | ✗ | ✗ |

### Task Management

| Action | Admin | Project Manager | Team Member | Viewer |
|--------|-------|-----------------|-------------|--------|
| Create task | ✓ | member | member | ✗ |
| View tasks | ✓ | member | member | member |
| Edit task (any field) | ✓ | member | own / assigned | ✗ |
| Change task status | ✓ | member | own / assigned | ✗ |
| Delete task | ✓ | member | ✗ | ✗ |
| Add subtask | ✓ | member | member | ✗ |
| Add comment | ✓ | member | member | ✗ |
| Add attachment | ✓ | member | member | ✗ |
| Delete own comment | ✓ | own | own | ✗ |
| Delete any comment | ✓ | member (PM only) | ✗ | ✗ |

### Views & Dashboard

| Action | Admin | Project Manager | Team Member | Viewer |
|--------|-------|-----------------|-------------|--------|
| Kanban / List / Calendar view | ✓ | member | member | member |
| My Tasks view | ✓ | ✓ | ✓ | ✓ |
| Executive Dashboard | ✓ | ✓ | ✗ | ✗ |

### Notifications & Search

| Action | Admin | Project Manager | Team Member | Viewer |
|--------|-------|-----------------|-------------|--------|
| Receive / read notifications | ✓ | ✓ | ✓ | ✓ |
| Global search | ✓ | member | member | member |

---

## 5. User Stories & Acceptance Criteria

Each story follows **Given / When / Then** and is mapped to an RFP Acceptance Criteria checklist item.

---

### US-UM-01 — User Registration

**As a** new user, **I want to** register with my email and password **so that** I can access the platform.

| Given | When | Then |
|-------|------|------|
| I am on the registration page | I submit a valid email and password (≥8 chars) | My account is created, I am logged in, and redirected to the dashboard |
| I am on the registration page | I submit an already-registered email | I see an error: "Email already in use" |
| I am on the registration page | I submit a password shorter than 8 characters | I see a validation error before submission |

**RFP AC:** §6 AC-1 (user registration and login functional)

---

### US-UM-02 — Admin Creates User

**As an** Admin, **I want to** create user accounts **so that** I can onboard team members without self-registration.

| Given | When | Then |
|-------|------|------|
| I am logged in as Admin, on the admin user panel | I fill in name, email, role, department and submit | The new user account is created; the user can log in with a temporary password or password reset flow |
| I try to create a user with a duplicate email | — | I see an error: "Email already in use" |

**RFP AC:** §6 AC-2 (admin user management)

---

### US-UM-03 — User Deactivation

**As an** Admin, **I want to** deactivate a user **so that** former team members cannot access the system.

| Given | When | Then |
|-------|------|------|
| I am Admin and the target user is active | I deactivate the user | Their status changes to Inactive; any subsequent login attempt returns 401 |
| The deactivated user has assigned tasks | After deactivation | Tasks remain assigned (not reassigned automatically); project members see the deactivated label |

**RFP AC:** §6 AC-2

---

### US-UM-04 — User Profile

**As a** user, **I want to** update my profile (name, avatar, department) **so that** my teammates can identify me.

| Given | When | Then |
|-------|------|------|
| I am logged in | I navigate to My Profile and update name/avatar/department | Changes are saved and immediately visible in comments and task assignments |
| I upload an avatar image | — | Image is stored; my avatar appears in the header and task cards |

**RFP AC:** §6 AC-2

---

### US-PM-01 — Create Project

**As a** Project Manager, **I want to** create a project **so that** I can organise tasks around a client engagement.

| Given | When | Then |
|-------|------|------|
| I am logged in as PM | I provide project name, description, start/end dates, and submit | The project is created with status **Planning** and appears in the project list |
| The project name is empty | — | I see a validation error |

**RFP AC:** §6 AC-3 (project CRUD)

---

### US-PM-02 — Project Status & Archive

**As an** Admin or PM, **I want to** change a project's status and archive completed projects **so that** my workspace stays organised.

| Given | When | Then |
|-------|------|------|
| A project exists | I change its status to Active/On Hold/Completed | Status updates immediately and is reflected in all views |
| I archive a project | — | The project moves to an Archived section; tasks become read-only |

**RFP AC:** §6 AC-3

---

### US-PM-03 — Project Progress

**As a** PM, **I want to** see percentage progress per project **so that** I can report to stakeholders.

| Given | When | Then |
|-------|------|------|
| A project has tasks | I view the project | Progress % = (Done tasks / total tasks) × 100, rounded to nearest integer |
| All tasks are Done | — | Progress shows 100% |
| No tasks exist | — | Progress shows 0% or "No tasks yet" |

**RFP AC:** §6 AC-3

---

### US-TM-01 — Create Task

**As a** PM or Team Member, **I want to** create tasks inside a project **so that** work is tracked.

| Given | When | Then |
|-------|------|------|
| I am a project member with create permission | I fill title, optional description, assignee, due date, priority and submit | Task is created with status **To Do** and appears in all views |
| Title is empty | — | Validation error; task not saved |

**RFP AC:** §6 AC-4 (task creation and management)

---

### US-TM-02 — Task Status Workflow

**As an** assignee, **I want to** move tasks through statuses **so that** progress is visible to the team.

| Given | When | Then |
|-------|------|------|
| A task is **To Do** | I drag it to In Progress on Kanban | Status updates to **In Progress**; activity log entry created |
| A task is **In Progress** | I move it to In Review | Status updates; notification sent to PM/owner |
| A task is **In Review** | PM moves it to Done | Status updates to **Done**; progress % recalculates |

**RFP AC:** §6 AC-4

---

### US-TM-03 — Subtasks

**As a** PM, **I want to** break tasks into subtasks **so that** complex work is manageable.

| Given | When | Then |
|-------|------|------|
| A task exists | I add a subtask with title, assignee, due date, priority | Subtask appears nested under the parent; it has its own status |
| I try to add a subtask to a subtask | — | The UI does not offer this option (one level only) |

**RFP AC:** §6 AC-4

---

### US-TM-04 — Comments & @mentions

**As a** team member, **I want to** comment on a task and @mention a colleague **so that** they are notified.

| Given | When | Then |
|-------|------|------|
| I am viewing a task | I type a comment with @username and submit | Comment is saved; the mentioned user receives an in-app notification |
| I submit an empty comment | — | Error or button disabled |

**RFP AC:** §6 AC-4

---

### US-TM-05 — File Attachments

**As a** team member, **I want to** attach files to a task **so that** supporting documents are co-located with the work.

| Given | When | Then |
|-------|------|------|
| I am viewing a task | I attach a file ≤10 MB | File is uploaded, stored, and listed in the attachments section; other members can download it |
| I attach a file >10 MB | — | Upload is rejected with a clear size error |

**RFP AC:** §6 AC-4

---

### US-TM-06 — Activity Log

**As a** PM, **I want to** see a full activity log per task **so that** I can audit changes.

| Given | When | Then |
|-------|------|------|
| Any change is made to a task | — | An activity entry with actor name, action, and timestamp is appended to the log |
| I view the activity log | — | Entries are shown in reverse chronological order |

**RFP AC:** §6 AC-4

---

### US-VW-01 — Kanban View

**As a** team member, **I want to** see a Kanban board **so that** I can visualise workflow at a glance.

| Given | When | Then |
|-------|------|------|
| I open a project | I select Kanban view | Tasks are shown as cards in columns: To Do / In Progress / In Review / Done |
| I drag a card to another column | — | Task status updates immediately; no page refresh needed |

**RFP AC:** §6 AC-5 (multiple views)

---

### US-VW-02 — Calendar View

**As a** PM, **I want to** see tasks on a calendar **so that** I can manage deadlines visually.

| Given | When | Then |
|-------|------|------|
| I open Calendar view | — | Tasks with due dates appear on their due date on the calendar |
| I click a task on the calendar | — | Task detail panel or modal opens |

**RFP AC:** §6 AC-5

---

### US-VW-03 — My Tasks View

**As a** team member, **I want to** see all tasks assigned to me across projects **so that** I can prioritise my day.

| Given | When | Then |
|-------|------|------|
| I navigate to My Tasks | — | All open tasks assigned to me, across all my projects, are listed sorted by due date ascending |
| I have no assigned tasks | — | I see an empty-state message |

**RFP AC:** §6 AC-5

---

### US-NT-01 — In-App Notifications

**As a** user, **I want to** receive in-app notifications **so that** I stay informed without polling manually.

| Given | When | Then |
|-------|------|------|
| A task is assigned to me | — | I receive a notification; unread count on bell icon increments |
| Someone @mentions me in a comment | — | I receive a notification |
| A task I own is due in 24 hours | — | I receive a reminder notification |
| A task I own or am assigned to changes status | — | I receive a notification |

**RFP AC:** §6 AC-6 (notification system)

---

### US-NT-02 — Mark Notifications Read

**As a** user, **I want to** mark notifications as read **so that** my unread count accurately reflects new activity.

| Given | When | Then |
|-------|------|------|
| I have unread notifications | I click one | It is marked read; count decrements |
| I click "Mark All Read" | — | All notifications marked read; count resets to 0 |

**RFP AC:** §6 AC-6

---

### US-ED-01 — Executive Dashboard Overview

**As an** Admin or PM, **I want to** see key metrics on a dashboard **so that** I can report project health to executives.

| Given | When | Then |
|-------|------|------|
| I navigate to Dashboard | — | I see: active project count, overdue task count, tasks-done-this-week count |
| I apply department filter | — | All counts and charts update to reflect only that department's projects |
| I apply date range filter | — | Tasks-done-this-week updates to the selected range |

**RFP AC:** §6 AC-7 (executive dashboard)

---

### US-ED-02 — Project Health Indicator

**As an** Admin, **I want to** see a RAG (Red/Amber/Green) status per project **so that** I can identify at-risk projects.

| Given | When | Then |
|-------|------|------|
| A project has 0% overdue tasks | — | Health = Green |
| A project has 1–25% overdue tasks | — | Health = Amber |
| A project has >25% overdue tasks | — | Health = Red |

**RFP AC:** §6 AC-7

---

### US-SR-01 — Global Search

**As a** user, **I want to** search across all my projects **so that** I can quickly find a task or project.

| Given | When | Then |
|-------|------|------|
| I type in the search bar | After ≥2 characters | Results appear showing matching projects, tasks, and comments within my accessible scope |
| I apply an assignee filter | — | Results narrow to tasks assigned to the selected user |
| I click a result | — | I am taken directly to the task or project |

**RFP AC:** §6 AC-8 (search and filter)

---

## 6. Scope Boundaries & Assumptions

See `docs/ASSUMPTIONS.md` for the full numbered list. Summary of hard scope boundaries:

- **In scope:** All features in §2, deployed via Docker Compose, using Next.js + PostgreSQL + REST API.
- **Out of scope:** Email/SMS notifications, third-party integrations, mobile native apps, multi-tenant SaaS, recurring tasks, Gantt chart, time tracking, billing/invoicing, SSO/OAuth, real-time WebSocket push (polling acceptable for notifications).

---

## 7. Requirements Traceability

| Req ID | Title | RFP Section | Acceptance Criterion | QA Test Area |
|--------|-------|-------------|----------------------|--------------|
| FR-UM-001 | User registration | RFP §3.1 | AC-1 | Auth / Registration |
| FR-UM-002 | User login | RFP §3.1 | AC-1 | Auth / Login |
| FR-UM-003 | Role definitions | RFP §3.1 | AC-2 | RBAC |
| FR-UM-004 | Admin create user | RFP §3.1 | AC-2 | Admin panel |
| FR-UM-005 | Admin deactivate user | RFP §3.1 | AC-2 | Admin panel |
| FR-UM-006 | User profile fields | RFP §3.1 | AC-2 | Profile page |
| FR-UM-007 | Edit own profile | RFP §3.1 | AC-2 | Profile edit |
| FR-UM-008 | bcrypt passwords | RFP §4 NFR | AC-9 (Security) | Security audit |
| FR-UM-009 | JWT + refresh tokens | RFP §4 NFR | AC-9 | Auth flow |
| FR-PM-001 | Create project | RFP §3.2 | AC-3 | Project CRUD |
| FR-PM-002 | Project statuses | RFP §3.2 | AC-3 | Project status flow |
| FR-PM-003 | Update/delete project | RFP §3.2 | AC-3 | Project CRUD |
| FR-PM-004 | Archive project | RFP §3.2 | AC-3 | Project archive |
| FR-PM-005 | Multiple members | RFP §3.2 | AC-3 | Membership management |
| FR-PM-006 | % progress | RFP §3.2 | AC-3 | Progress calculation |
| FR-TM-001 | Task fields | RFP §3.3 | AC-4 | Task creation |
| FR-TM-002 | Task priorities | RFP §3.3 | AC-4 | Task priority |
| FR-TM-003 | Task statuses | RFP §3.3 | AC-4 | Task status flow |
| FR-TM-004 | Subtasks (1 level) | RFP §3.3 | AC-4 | Subtask management |
| FR-TM-005 | Comments & @mentions | RFP §3.3 | AC-4 | Comments / Notifications |
| FR-TM-006 | File attachments ≤10MB | RFP §3.3 | AC-4 | Upload / Storage |
| FR-TM-007 | Activity log | RFP §3.3 | AC-4 | Audit trail |
| FR-VW-001 | Kanban drag-drop | RFP §3.4 | AC-5 | Kanban view |
| FR-VW-002 | List view | RFP §3.4 | AC-5 | List view |
| FR-VW-003 | Calendar view | RFP §3.4 | AC-5 | Calendar view |
| FR-VW-004 | My Tasks view | RFP §3.4 | AC-5 | My Tasks |
| FR-NT-001 | Notification triggers | RFP §3.5 | AC-6 | Notification system |
| FR-NT-002 | Bell icon + unread count | RFP §3.5 | AC-6 | UI / Header |
| FR-NT-003 | Mark individual read | RFP §3.5 | AC-6 | Notifications |
| FR-NT-004 | Mark all read | RFP §3.5 | AC-6 | Notifications |
| FR-ED-001 | Dashboard KPIs | RFP §3.6 | AC-7 | Dashboard |
| FR-ED-002 | RAG health indicator | RFP §3.6 | AC-7 | Dashboard / Project health |
| FR-ED-003 | Team workload chart | RFP §3.6 | AC-7 | Dashboard / Charts |
| FR-ED-004 | Dept / date filter | RFP §3.6 | AC-7 | Dashboard filters |
| FR-SR-001 | Global search | RFP §3.7 | AC-8 | Search |
| FR-SR-002 | Search filters | RFP §3.7 | AC-8 | Search filters |
| FR-SR-003 | Scoped results | RFP §3.7 | AC-8 | Search / RBAC |
| NFR-001 | Page load ≤2s | RFP §4 | AC-9 (Performance) | Load testing |
| NFR-002 | API ≤500ms | RFP §4 | AC-9 | API benchmarks |
| NFR-007 | 500 concurrent users | RFP §4 | AC-9 | Load testing |
| NFR-010 | 99.5% uptime | RFP §4 | AC-9 | Monitoring / SLO |
| NFR-011 | `docker compose up` | RFP §5 | AC-10 (Delivery) | Deployment test |
| NFR-012 | OpenAPI docs | RFP §5 | AC-10 | API docs check |

---

*End of PRD v1.0 — Pending Delivery Director Gate-1 approval*
