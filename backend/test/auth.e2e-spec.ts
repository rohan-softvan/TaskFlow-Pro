import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma';

// ADLAAAA-21 — Slice 1 E2E happy-path.
// Mirrors the slice demo: Register -> land on app (token auto-refreshes) ->
// logout revokes. Runs against the real Nest app + Postgres (DATABASE_URL),
// which is how it executes under `docker compose up --build` / CI.
describe('Auth flow (e2e) — ADLAAAA-21', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const user = {
    email: 'e2e-auth@example.com',
    password: 'S3cur3P@ss!',
    fullName: 'E2E Auth User',
  };

  const cleanup = async () => {
    const existing = await prisma.user.findUnique({
      where: { email: user.email },
    });
    if (existing) {
      await prisma.refreshToken.deleteMany({ where: { userId: existing.id } });
      await prisma.user.delete({ where: { id: existing.id } });
    }
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    // Match production bootstrap (main.ts) so routes/cookies behave identically.
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('register -> refresh (auto-refresh) -> logout (revokes)', async () => {
    const server = app.getHttpServer();

    // 1. Register — land on app with an access token + httpOnly refresh cookie.
    const registerRes = await request(server)
      .post('/api/auth/register')
      .send(user)
      .expect(201);

    expect(registerRes.body.accessToken).toEqual(expect.any(String));
    expect(registerRes.body.expiresIn).toBe(900);

    const registerCookies = registerRes.headers['set-cookie'] as unknown as
      | string[]
      | undefined;
    expect(registerCookies).toBeDefined();
    const refreshCookie = (registerCookies ?? []).find((c) =>
      c.startsWith('refresh_token='),
    );
    expect(refreshCookie).toBeDefined();
    // Refresh token must be httpOnly (not readable by JS).
    expect(refreshCookie).toContain('HttpOnly');

    // 2. Token auto-refreshes — presenting the cookie rotates it.
    const refreshRes = await request(server)
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie!)
      .expect(201);

    expect(refreshRes.body.accessToken).toEqual(expect.any(String));
    const rotatedCookie = (
      (refreshRes.headers['set-cookie'] as unknown as string[]) ?? []
    ).find((c) => c.startsWith('refresh_token='));
    expect(rotatedCookie).toBeDefined();
    expect(rotatedCookie).not.toBe(refreshCookie); // rotation

    // 3. Logout revokes — the rotated token can no longer be refreshed.
    await request(server)
      .post('/api/auth/logout')
      .set('Cookie', rotatedCookie!)
      .expect(201);

    await request(server)
      .post('/api/auth/refresh')
      .set('Cookie', rotatedCookie!)
      .expect(401);
  });
});
