# TaskFlow Pro — Engineering Conventions (AGENTS.md)

## Golden rules
- Every commit references its Paperclip issue id (e.g. `feat(tasks): ... (ADLAAAA-N)`).
- One vertical slice per issue: DB + API + UI + test, independently demonstrable.
- App must always run with `docker compose up --build`.

## Backend (NestJS)
- One module per resource under `src/modules/<resource>/`.
- Controllers thin; business logic in services; DB access via Prisma only.
- Every DTO uses class-validator; every write route sanitizes input.
- Every route decorated with @ApiOperation + @Roles(...) — Swagger + RBAC are not optional.
- Never log tokens, passwords, or PII.

## Frontend (Next.js)
- App Router; server components for reads, client components for interactivity.
- API access via `lib/api` client only; auth token in memory + refresh cookie.
- TanStack Query for server state; 30s polling for notifications.

## Naming & style
- TypeScript strict; ESLint + Prettier enforced in CI.
- snake_case in DB, camelCase in TS DTOs (Prisma maps).
- Enum values match the ARCHITECTURE.md DDL exactly.

## Testing
- Each slice ships >= 1 supertest API test + >= 1 Playwright happy-path.
- PRs green on lint + unit + e2e before review.

## Definition of Done (per slice)
- Traces to FR/NFR IDs; Swagger updated; migration committed; demoable in the running stack.