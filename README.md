# TaskFlow Pro

Team Task & Project Management Platform

**Client:** Meridian Consulting Group  
**RFP:** MCG-2026-0042

---

## Quick Start

### Prerequisites

- Docker & Docker Compose (v2+)

### Run

```bash
# 1. Clone the repository
git clone https://github.com/rohan-softvan/TaskFlow-Pro.git
cd TaskFlow-Pro

# 2. Copy the environment file and customize if needed
cp .env.example .env

# 3. Start all services
docker compose up --build
```

The stack starts three containers:
| Service | URL | Description |
|---------|-----|-------------|
| **web**  | http://localhost:3000 | Next.js frontend |
| **api**  | http://localhost:3001/api | NestJS REST API + Swagger |
| **db**   | postgresql://localhost:5432 | PostgreSQL 16 |

### First Login

On first boot, the API automatically seeds an admin user:

| Field | Value |
|-------|-------|
| Email | `admin@taskflow.local` |
| Password | `Admin123!` |

> ⚠️ Change this password after first login. Customize via `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `.env`.

### API Documentation

Once running, visit http://localhost:3001/api/docs for the interactive Swagger UI.

---

## Architecture

```
web  (Next.js :3000)  ──REST──▶  api  (NestJS :3001)  ──Prisma──▶  db  (Postgres :5432)
                                                                       │
                                                                  volume: pgdata
```

- **Frontend:** Next.js 14 (App Router) + React 18 + Tailwind CSS + TanStack Query
- **Backend:** NestJS 10 + Prisma ORM + Passport JWT auth
- **Database:** PostgreSQL 16 with `citext`, `pgcrypto`
- **Auth:** JWT access (15m) + refresh (7d, httpOnly cookie, hashed at rest, rotation)
- **File storage:** Local Docker named volume (`uploads_data`) via multer

---

## Environment Variables

See `.env.example` for all required variables and their defaults.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | yes | `postgresql://...` | Postgres connection string |
| `JWT_ACCESS_SECRET` | yes | `change-me-...` | Access token signing key (≥32 chars) |
| `JWT_REFRESH_SECRET` | yes | `change-me-...` | Refresh token signing key (≥32 chars) |
| `CORS_ORIGIN` | no | `http://localhost:3000` | Allowed CORS origin |
| `SEED_ADMIN_EMAIL` | no | `admin@taskflow.local` | Seed admin email |
| `SEED_ADMIN_PASSWORD` | no | `Admin123!` | Seed admin password |

---

## Project Structure

```
TaskFlow-Pro/
├── docker-compose.yml     # web + api + db with healthchecks
├── .env.example           # Documented env var template
├── README.md              # This file
├── backend/               # NestJS API (port 3001)
│   ├── Dockerfile
│   ├── prisma/
│   │   ├── schema.prisma  # 8 models, 7 enums
│   │   ├── seed.js        # Idempotent admin seeder
│   │   └── migrations/
│   ├── src/               # NestJS source (auth, users, projects, ...)
│   └── test/              # Jest + Supertest E2E tests
├── frontend/              # Next.js App (port 3000)
│   ├── Dockerfile
│   ├── src/
│   │   └── app/           # App Router pages
│   └── test/              # Playwright E2E tests
└── docs/                  # PRD, Architecture, Wireframes, Slice Plan
```

---

## Development

### Backend

```bash
cd backend
npm install
npx prisma migrate dev
npx prisma generate
npm run start:dev    # http://localhost:3001
npm run test         # Unit tests
npm run test:e2e     # E2E tests (requires PostgreSQL)
```

### Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
npm run test:e2e     # Playwright tests (requires full stack)
```

---

## Security

- **Helmet** applied globally for HTTP security headers
- **Rate limiting** on all auth routes (20 req/min per IP)
- **CORS** restricted to configured origin
- **Pino logger** redacts passwords, tokens, and secrets from logs
- **Refresh tokens** stored hashed (SHA-256), never in plaintext
- **Input validation** via class-validator + sanitize-html
- **Prisma** parameterizes all queries (SQL injection prevention)

---

## License

Proprietary — Meridian Consulting Group