# TaskFlow Pro — UI/UX Wireframes (RFP Deliverable 3)

**Client:** Meridian Consulting Group
**RFP Reference:** MCG-2026-0042
**ADL Issue:** ADLAAAA-4 (Gate 2)
**Depends on:** `docs/PRD.md` (Gate-1 APPROVED), `docs/ARCHITECTURE.md`
**Version:** 1.0
**Date:** 2026-07-11
**Status:** Draft — Pending Gate-2 (Delivery Director) approval
**Fidelity:** Low-fidelity ASCII/markdown wireframes. Not visual design; they fix layout, states, and role-conditional elements so engineering slices are unambiguous.

> Every screen cites the PRD FR/NFR ID(s) it satisfies. Responsive rules per NFR-009 (desktop ≥1280px, tablet 768–1279px). Role-conditional elements marked **[role]**.

---

## Global Conventions

**App shell (present on every authenticated screen):**

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ☰  TaskFlow Pro    [ 🔍 Global search…            ]      🔔(3)   ▢ Avatar ▾ │  ← global header
├────────────┬─────────────────────────────────────────────────────────────┤
│ SIDEBAR    │                                                              │
│ ▸ Dashboard│              << MAIN CONTENT AREA >>                         │
│   [Adm/PM] │                                                              │
│ ▸ Projects │                                                              │
│ ▸ My Tasks │                                                              │
│ ▸ Admin    │                                                              │
│   [Admin]  │                                                              │
│ ▸ Profile  │                                                              │
└────────────┴─────────────────────────────────────────────────────────────┘
```

- **🔍 Global search** — always in header (FR-SR-001). Opens results overlay after ≥2 chars (US-SR-01).
- **🔔 bell + unread badge** — count of unread notifications (FR-NT-002); polled every 30s (A-005); opens Notifications panel (below).
- **Avatar ▾** — menu: Profile, Change password, Logout.
- **Sidebar role-gating:** *Dashboard* visible only to **[Admin/PM]** (FR-ED-006); *Admin* visible only to **[Admin]** (FR-UM-004/005).
- **Tablet (<1280px):** sidebar collapses behind the ☰ hamburger; content is single-column.
- **Global states:** every data screen has **loading** (skeleton), **empty** (friendly message + primary CTA), **error** (retry), and **403** (for role-blocked deep links) states.

---

## 1. Login / Register  (FR-UM-001, FR-UM-002, US-UM-01)

```
                    ┌───────────────────────────────┐
                    │        TaskFlow Pro           │
                    │                               │
                    │  [ Login ]   Register          │  ← tab toggle
                    │                               │
                    │  Email    [___________________]│
                    │  Password [___________________]│
                    │                               │
                    │  ( ! Email or password wrong ) │  ← error state (401)
                    │                               │
                    │        [   Log in   ]          │
                    │                               │
                    │  Forgot password? · Register    │
                    └───────────────────────────────┘
```

- **Register tab** adds: Full name, Confirm password. Password ≥8 chars validated inline before submit (US-UM-01).
- **States:** duplicate email → "Email already in use" (409); inactive account → "Account deactivated" (401, US-UM-03); success → redirect to Dashboard (Admin/PM) or My Tasks (Member/Viewer).
- **must_reset_pw** users (admin-created, A-006) are routed to a forced Change-Password screen after first login.

---

## 2. Executive Dashboard  **[Admin/PM only]**  (FR-ED-001..006, US-ED-01/02)

```
┌─ Dashboard ───────────────────────────────────────────────────────────────┐
│ Filters:  Department [ All ▾ ]   Date range [ This week ▾ ]   [↻ Refresh]  │  FR-ED-004/005
├─────────────────────────────────────────────────────────────────────────── │
│ ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐            │
│ │ Active         │  │ Overdue        │  │ Completed this week    │  ← KPIs   │
│ │ Projects   12  │  │ Tasks      7   │  │ Tasks            34    │  FR-ED-001│
│ └───────────────┘  └───────────────┘  └───────────────────────┘            │
│                                                                             │
│  Project Health (RAG)                     Team Workload (open tasks)        │
│  ┌──────────────────────────┐            ┌──────────────────────────────┐  │
│  │ ● Apollo Migration    ●R  │            │ Alice  ███████████ 11        │  │
│  │ ● Beacon Redesign     ●A  │            │ Bob    ██████ 6              │  │
│  │ ● Compass Rollout     ●G  │            │ Carol  ████ 4                │  │
│  │  (R>25% · A 1–25% · G 0%) │            │ …                            │  │
│  └──────────────────────────┘            └──────────────────────────────┘  │
│   FR-ED-002 (A-012)                        FR-ED-003 (A-011)                │
└─────────────────────────────────────────────────────────────────────────── ┘
```

- Clicking a RAG project row → Project detail. Department/date filters re-query all tiles (US-ED-01).
- **Empty state:** "No projects match these filters."
- Non-Admin/PM reaching `/dashboard` → 403 screen (FR-ED-006).

---

## 3. Project List  (FR-PM-001, FR-PM-008, US-PM-01)

```
┌─ Projects ────────────────────────────────────────────────────────────────┐
│  Sort [ Name ▾ ] [ Status ▾ ] [ Date ▾ ]   ☐ Show archived   [+ New] [Adm/PM]│ FR-PM-008/004
├─────────────────────────────────────────────────────────────────────────── │
│  Name            Status     Owner     Progress      End date                │
│  ─────────────────────────────────────────────────────────────────────     │
│  Apollo Migration ●Active   Alice     ███████░ 72%  2026-08-01              │  FR-PM-006
│  Beacon Redesign  ●Planning Bob       ░░░░░░░░ 0%   2026-09-15              │
│  Compass Rollout  ●On Hold  Carol     ████░░░░ 40%  —                       │
│  …                                                                          │
│  ‹ 1 2 3 ›  (paginated)                                                     │  FR-PM-008
└─────────────────────────────────────────────────────────────────────────── ┘
```

- **[+ New]** only for **[Admin/PM]** (§4 matrix). Archived hidden unless checkbox on (FR-PM-004).
- **New project modal:** Name*, Description, Start date, End date → created as **Planning** (US-PM-01).
- **Empty state:** "No projects yet." + CTA for Admin/PM.

---

## 4. Project Detail  (FR-PM-002/003/004/006/007, US-PM-02/03)

```
┌─ Apollo Migration  ●Active ▾   [Edit][Archive][Delete]  ← [owner]/[Admin] ──┐  FR-PM-003/004/007
│  Owner: Alice · 2026-05-01 → 2026-08-01 · Progress ███████░ 72%             │  FR-PM-006
│  Members: (Alice) (Bob) (Carol) (+ Add) [owner]                             │  FR-PM-005
├─────────────────────────────────────────────────────────────────────────── │
│  View:  [ Kanban ] [ List ] [ Calendar ]        [+ New task] [not Viewer]   │  FR-VW-001/002/003
│  Filters: Status ▾  Priority ▾  Assignee ▾  Due ▾                           │
│  ───────────────────────────────────────────────────────────────────────   │
│                << active view renders here (screens 5–7) >>                 │
└─────────────────────────────────────────────────────────────────────────── ┘
```

- Status dropdown & Edit/Archive/Delete gated to project **owner/Admin** (§4). Delete = **[Admin]** only.
- Archived project → banner "Read-only (archived)"; all mutating controls disabled (FR-PM-004).
- The **selected view is remembered per user** in browser storage (FR-VW-005).

---

## 5. Kanban View  (FR-VW-001, FR-TM-009, US-VW-01)

```
┌─ Kanban ────────────────────────────────────────────────────────────────── ┐
│  To Do (5)        In Progress (3)     In Review (2)      Done (12)          │
│  ┌────────────┐   ┌────────────┐      ┌────────────┐     ┌────────────┐     │
│  │ ●High       │   │ ●Med        │      │ ●Crit       │     │ Deploy API  │     │
│  │ Set up CI   │   │ Auth module │      │ Search API  │     │ ✔           │     │
│  │ 👤Bob 07-14 │   │ 👤Alice     │      │ 👤Carol     │     │ 👤Bob       │     │
│  └────────────┘   └────────────┘      └────────────┘     └────────────┘     │
│  │ …drag cards between columns → PATCH status (FR-TM-009)… │                 │
└─────────────────────────────────────────────────────────────────────────── ┘
```

- Drag card across column → optimistic status update; activity entry + notification on drop (US-TM-02). No page refresh (US-VW-01).
- Card shows priority dot, title, assignee avatar, due date. **Viewer** = read-only (no drag) per §4.

---

## 6. List View  (FR-VW-002, US-TM tabular)

```
┌─ List ────────────────────────────────────────────────────────────────────┐
│ ▢  Title            Status▾    Priority▾  Assignee▾   Due▾        ⋯         │  sortable cols
│ ── ──────────────────────────────────────────────────────────────────────  │
│ ▢  Set up CI        To Do      ●High      Bob         2026-07-14  [edit▾]   │  inline status edit (FR-TM-009)
│ ▢  Auth module      In Prog.   ●Medium    Alice       2026-07-18  [edit▾]   │
│ ▢  Search API       In Review  ●Critical  Carol       2026-07-12  [edit▾]   │
│ …                                                                           │
│ ‹ 1 2 › (paginated)                                                         │
└─────────────────────────────────────────────────────────────────────────── ┘
```

- Any column header sorts (FR-VW-002). Inline status dropdown updates via PATCH (FR-TM-009).
- Row click → Task detail (screen 8).

---

## 7. Calendar View  (FR-VW-003, US-VW-02)

```
┌─ Calendar — July 2026 ────────────────────  ‹ Prev  [ Today ]  Next › ─────┐
│  Mon    Tue    Wed    Thu    Fri    Sat    Sun                             │
│  ───────────────────────────────────────────────────────────────────────  │
│   30     1      2      3      4      5      6                               │
│                       •CI                                                   │
│   7      8      9      10     11     12     13                              │
│               •Auth          •Search•Docs                                   │
│   14     15     16     17     18     19     20                              │
│  •CI                         •Auth                                          │
│  … tasks rendered on their due_date; click a •task → Task detail modal      │  US-VW-02
└─────────────────────────────────────────────────────────────────────────── ┘
```

- Dots = tasks due that day, colored by priority. Click → task detail modal (US-VW-02).
- **Empty state:** month with no due tasks shows "No deadlines this month."

---

## 8. Task Detail  (FR-TM-001..008, FR-TM-005/006/007, US-TM-01/04/05/06)

```
┌─ Task: Auth module ─────────────────────────────────────────  [Edit][Delete]┐  FR-TM-008 (§4 RBAC)
│  Status [ In Progress ▾ ]   Priority [ Medium ▾ ]                           │  FR-TM-002/003
│  Assignee [ Alice ▾ ]       Due [ 2026-07-18 ]                              │  FR-TM-001
│  Description: ……………………………………………………………………                              │
│  ─────────────────────────────────────────────────────────────────────     │
│  ▸ Subtasks (2/3 done)                                        [+ Subtask]   │  FR-TM-004 (one level)
│     ☑ Token issuance    In Review   👤Bob                                   │
│     ☐ Refresh rotation  To Do       👤Alice                                 │
│  ─────────────────────────────────────────────────────────────────────     │
│  ▸ Attachments (2)                                            [+ Upload]    │  FR-TM-006 ≤10MB
│     📎 spec.pdf  (1.2MB) [download]      📎 diagram.png (400KB) [download]   │
│     ( ! File exceeds 10MB )  ← reject state (413, US-TM-05)                  │
│  ─────────────────────────────────────────────────────────────────────     │
│  ▸ Comments                                                                 │  FR-TM-005
│     👤Bob: looks good @Alice can you review?   · 2h ago                     │  @mention → notif
│     [ Write a comment… @mention supported ]                    [ Send ]     │
│  ─────────────────────────────────────────────────────────────────────     │
│  ▸ Activity log (reverse chronological)                                     │  FR-TM-007, US-TM-06
│     • Alice changed status To Do → In Progress · 07-10 09:12                │
│     • Bob added attachment spec.pdf · 07-09 16:40                           │
└─────────────────────────────────────────────────────────────────────────── ┘
```

- **Subtasks** offer **no** further "+Subtask" (one level, US-TM-03). Nested items have own status/assignee.
- **@mention** autocompletes project members; submit notifies mentioned user (US-TM-04).
- Edit/Delete visibility per §4: **Team Member** edits only own/assigned; Delete = **[Admin/PM]**; comment delete = own / PM / Admin.
- Free-text (description, comments) sanitized server-side; rendered escaped (NFR-005).

---

## 9. My Tasks  (FR-VW-004, US-VW-03)

```
┌─ My Tasks (across all projects) ───────────────────────────────────────────┐
│  Sorted by due date ↑                                                       │
│  ── Overdue ────────────────────────────────────────────────────────────   │
│  ●Crit  Search API      Compass Rollout   Due 2026-07-09  In Review         │  US-VW-03
│  ── This week ──────────────────────────────────────────────────────────    │
│  ●High  Set up CI       Apollo Migration  Due 2026-07-14  To Do             │
│  ●Med   Auth module     Apollo Migration  Due 2026-07-18  In Progress       │
│  …                                                                          │
└─────────────────────────────────────────────────────────────────────────── ┘
```

- Aggregates open tasks assigned to current user across their projects, due-date ascending (US-VW-03).
- Row click → Task detail. **Empty state:** "You have no assigned tasks." (US-VW-03).

---

## 10. Notifications Panel  (FR-NT-001..006, US-NT-01/02)

```
      ┌─ Notifications ──────────────────  [ Mark all read ] ─┐   ← 🔔 popover
      │ ● Task "Search API" assigned to you       · 5m        │  FR-NT-001
      │ ● @mention by Bob on "Auth module"        · 2h        │  FR-TM-005
      │ ○ "Set up CI" is due in 24 hours          · 6h        │  A-010 cron
      │ ○ "Deploy API" status → Done              · 1d        │
      │ ──────────────────────────────────────────────────   │
      │              [ Load more ]  (50 recent, FR-NT-006)    │
      └───────────────────────────────────────────────────── ┘
```

- ● unread / ○ read. Click a row → mark read (count decrements) + navigate to the task (FR-NT-003, US-NT-02).
- **Mark all read** resets badge to 0 (FR-NT-004). Polled every 30s (A-005). In-app only (FR-NT-005).

---

## 11. Admin — User Management  **[Admin only]**  (FR-UM-003/004/005, US-UM-02/03)

```
┌─ Admin · Users ───────────────────────────────────  [+ Create user] ───────┐
│  Name       Email              Role        Dept       Status    Actions     │
│  ──────────────────────────────────────────────────────────────────────    │
│  Alice      alice@mcg.com      PM ▾        Product    Active     [reset pw]  │  FR-UM-003
│  Bob        bob@mcg.com        Member ▾    Eng        Active     [deactivate]│  FR-UM-005
│  Carol      carol@mcg.com      Viewer ▾    Eng        Inactive   [activate]  │
│  ‹ 1 2 › (paginated)                                                        │
└─────────────────────────────────────────────────────────────────────────── ┘
```

- **Create user modal:** Full name*, Email*, Role*, Department → issues temp password / must_reset_pw (US-UM-02, A-006).
- Role dropdown edits global role (FR-UM-003). Deactivate → user can't log in, keeps assigned tasks (US-UM-03).
- Duplicate email → "Email already in use" (409). Non-Admin deep link → 403.

---

## 12. Profile  (FR-UM-006/007, US-UM-04)

```
┌─ My Profile ──────────────────────────────────────────────────────────────┐
│   ▢ Avatar   [ Change photo ]   (≤2MB, A-007)                              │  FR-UM-006
│   Full name  [ Alice Turner________ ]                                       │  FR-UM-007
│   Department [ Product_____________ ]                                       │
│   Email      alice@mcg.com   (read-only)                                    │
│                                              [ Save changes ]               │
│   ── Security ─────────────────────────────────────────────────            │
│   [ Change password ]                                                       │
└─────────────────────────────────────────────────────────────────────────── ┘
```

- Avatar upload ≤2MB stored on volume (A-007); appears in header + task cards immediately (US-UM-04).
- Email is immutable in v1. Change password re-auths and clears must_reset_pw (A-006).

---

## 13. Global Search Results  (FR-SR-001..004, US-SR-01)

```
┌─ Search: "auth" ──────────────────────────────────────────────────────────┐
│  Filters: Assignee ▾  Status ▾  Priority ▾  Due range ▾                     │  FR-SR-002
│  ── Projects ─────────────────────────────────────────────────────────     │
│   📁 Authentication Revamp                          → open project          │  FR-SR-001/004
│  ── Tasks ────────────────────────────────────────────────────────────     │
│   ☑ Auth module        Apollo Migration  ●Med  Alice   → open task          │
│   ☑ Refresh rotation   Apollo Migration  ●Low  Bob     → open task          │
│  ── Comments ─────────────────────────────────────────────────────────     │
│   💬 "…auth flow needs review…" on Search API       → open task             │
└─────────────────────────────────────────────────────────────────────────── ┘
```

- Triggers after ≥2 chars (US-SR-01). Results scoped to the user's member projects only — no cross-boundary leakage (FR-SR-003).
- Grouped by Projects / Tasks / Comments; each links directly to the entity (FR-SR-004). Filters narrow tasks (FR-SR-002).
- **Empty state:** "No matches in your projects."

---

## Screen → FR Traceability

| Screen | Primary FR/NFR |
|--------|----------------|
| 1 Login/Register | FR-UM-001/002/008/009, A-006 |
| 2 Dashboard | FR-ED-001..006 |
| 3 Project List | FR-PM-001/004/008 |
| 4 Project Detail | FR-PM-002/003/004/005/006/007, FR-VW-005 |
| 5 Kanban | FR-VW-001, FR-TM-009 |
| 6 List | FR-VW-002, FR-TM-009 |
| 7 Calendar | FR-VW-003 |
| 8 Task Detail | FR-TM-001..008, FR-TM-005/006/007 |
| 9 My Tasks | FR-VW-004 |
| 10 Notifications | FR-NT-001..006 |
| 11 Admin Users | FR-UM-003/004/005 |
| 12 Profile | FR-UM-006/007 |
| 13 Search | FR-SR-001..004 |
| App shell (all) | FR-NT-002, FR-SR-001, NFR-009 |

---

*End of WIREFRAMES.md v1.0 — Pending Gate-2 (Delivery Director) approval.*
