# Contributing to TaskFlow Pro

This repository is delivered by the ADL (Autonomous Delivery Lab) pipeline. Every
contributor — human or agent — follows the rules below. They are enforced by the ADL
skills (`opencode-coding`, `docker-delivery`, `paperclip-handoff`) and by the Delivery
Director gate.

## Branching model

| Branch | Role | Who writes to it |
| ------ | ---- | ---------------- |
| `main` | **Production.** Protected. Release-only. | No direct commits. Updated **only** via a reviewed PR from `dev`. |
| `dev`  | **Development / integration.** Default working branch. | All vertical-slice work lands here. |

Rules:

1. **`main` is production.** Never commit or push directly to `main`. It only ever
   advances through a Pull Request opened from `dev`.
2. **`dev` is the development branch.** All coding, docs, and rework happen on `dev`
   (or short-lived feature branches that merge back into `dev`).
3. Optional per-slice feature branches (`feature/<issue-id>-<slug>`) may branch from
   `dev` and merge back into `dev`; they are never merged straight into `main`.

## Commit rules

1. **Every commit references its Paperclip issue id**, e.g.
   `ADLAAAA-34: add project creation endpoint`.
2. Prefer small, reviewable commits over one large commit.
3. No unrelated refactors "while in the area" — file a new issue instead.

## Push rules

1. **Push after every vertical slice is complete.** When a slice reaches a
   demonstrable, committed state, push `dev` to `origin` immediately — do not batch
   multiple slices into one deferred push.
2. If a push fails, retry; if it still fails, record it as a first-class blocker on the
   issue (do not silently drop the changes).
3. Pushes go to `dev`. `main` is never pushed to directly.

## Delivery / PR flow

1. Slices accumulate on `dev` and are verified there (`docker compose up --build`).
2. **When the project delivery is ready**, open a Pull Request from `dev` → `main`.
3. The delivery PR requires **Delivery Director approval** and **final human approval**
   before it is merged (see the ADL gate order). Merging the PR into `main` is the
   production release.
4. The PR description follows the ADL comment format (Output / Evidence / Decisions /
   Blockers / Next) and links the delivery issue.

## Definition of done for a slice

- [ ] Change is a thin, end-to-end, independently demonstrable vertical slice.
- [ ] Commit(s) reference the Paperclip issue id.
- [ ] Lint/build/test evidence recorded on the issue.
- [ ] `dev` pushed to `origin` after the slice is complete.
- [ ] Handoff comment posted in the ADL five-section format.
