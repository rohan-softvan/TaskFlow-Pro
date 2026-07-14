import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma';

// ADLAAAA-22 — Slice 2 RBAC Guards & Admin User Management E2E.
// Demo: Admin creates a Member, deactivates them -> login 403;
//        Member can't reach admin routes (403); forced change-password flow.
describe('RBAC & Admin User Management (e2e) — ADLAAAA-22', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const adminEmail = 'e2e-rbac-admin@example.com';
  const adminPassword = 'AdminS3cur3!';
  const memberEmail = 'e2e-rbac-member@example.com';
  const memberFullName = 'E2E RBAC Member';

  const cleanup = async () => {
    for (const email of [adminEmail, memberEmail]) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
      }
    }
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
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

    // Seed an admin user directly (register only creates Member role).
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        fullName: 'E2E RBAC Admin',
        role: UserRole.Admin,
        isActive: true,
        mustResetPw: false,
      },
    });
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  const loginAs = async (email: string, password: string) => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(201);
    return {
      accessToken: res.body.accessToken,
      role: res.body.role,
      mustResetPw: res.body.mustResetPw,
      cookie: (res.headers['set-cookie'] as unknown as string[]).find((c) =>
        c.startsWith('refresh_token='),
      ),
    };
  };

  let adminSession: Awaited<ReturnType<typeof loginAs>>;

  it('Admin logs in and can create a Member user', async () => {
    adminSession = await loginAs(adminEmail, adminPassword);
    expect(adminSession.role).toBe(UserRole.Admin);
    expect(adminSession.mustResetPw).toBe(false);

    const createRes = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${adminSession.accessToken}`)
      .send({ email: memberEmail, fullName: memberFullName, role: UserRole.Member })
      .expect(201);

    expect(createRes.body.email).toBe(memberEmail);
    expect(createRes.body.role).toBe(UserRole.Member);
    expect(createRes.body.tempPassword).toEqual(expect.any(String));
    expect(createRes.body.passwordHash).toBeUndefined();

    memberTempPassword = createRes.body.tempPassword;
  });

  let memberTempPassword: string;

  it('Member logs in with temp password and has mustResetPw set', async () => {
    const memberSession = await loginAs(memberEmail, memberTempPassword);
    expect(memberSession.mustResetPw).toBe(true);
    expect(memberSession.role).toBe(UserRole.Member);
    memberAccessToken = memberSession.accessToken;
  });

  let memberAccessToken: string;

  it('Member cannot access admin-only route (403)', async () => {
    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .expect(403);
  });

  it('Member with mustResetPw cannot access other routes (403)', async () => {
    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .expect(403);

    // Also blocked for project routes and any authenticated route
    await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .send({ fullName: 'Hacker' })
      .expect(403);
  });

  it('Member can change password despite mustResetPw (SkipMustResetPassword)', async () => {
    const newPw = 'N3wS3cur3P@ss!';
    const changeRes = await request(app.getHttpServer())
      .patch('/api/users/me/change-password')
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .send({ newPassword: newPw })
      .expect(200);

    expect(changeRes.body.message).toBe('Password updated');

    // After password change, mustResetPw should be cleared
    const reLogin = await loginAs(memberEmail, newPw);
    expect(reLogin.mustResetPw).toBe(false);
    memberAccessToken = reLogin.accessToken;
  });

  it('Member can now access own routes after password change', async () => {
    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .expect(200);
  });

  it('Member still cannot access admin-only routes (403)', async () => {
    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .expect(403);
  });

  it('Admin deactivates a Member -> login returns 403 (Account disabled)', async () => {
    const member = await prisma.user.findUnique({ where: { email: memberEmail } });
    await request(app.getHttpServer())
      .patch(`/api/users/${member!.id}/deactivate`)
      .set('Authorization', `Bearer ${adminSession.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: memberEmail, password: 'N3wS3cur3P@ss!' })
      .expect(403);
  });

  it('Admin can reactive and reset password', async () => {
    const member = await prisma.user.findUnique({ where: { email: memberEmail } });
    await request(app.getHttpServer())
      .patch(`/api/users/${member!.id}`)
      .set('Authorization', `Bearer ${adminSession.accessToken}`)
      .send({ isActive: true })
      .expect(200);

    const resetRes = await request(app.getHttpServer())
      .post(`/api/users/${member!.id}/reset-password`)
      .set('Authorization', `Bearer ${adminSession.accessToken}`)
      .expect(201);

    expect(resetRes.body.tempPassword).toEqual(expect.any(String));

    // Login with temp password -> mustResetPw is true again
    const reLogin = await loginAs(memberEmail, resetRes.body.tempPassword);
    expect(reLogin.mustResetPw).toBe(true);
  });

  // ── Avatar upload tests (ADLAAAA-23 DoD) ──────────────────────────────────

  it('Member can upload avatar ≤2MB', async () => {
    // 1KB valid PNG header + filler — multer only checks Content-Type for size limits
    const smallBuf = Buffer.alloc(1024, 0);
    const res = await request(app.getHttpServer())
      .post('/api/users/me/avatar')
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .attach('file', smallBuf, { filename: 'avatar.png', contentType: 'image/png' })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.avatarPath).toBeTruthy();
  });

  it('Member avatar upload >2MB is rejected (413)', async () => {
    const tooBig = Buffer.alloc(2 * 1024 * 1024 + 1, 0);
    await request(app.getHttpServer())
      .post('/api/users/me/avatar')
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .attach('file', tooBig, { filename: 'big.png', contentType: 'image/png' })
      .expect((res) => {
        expect([400, 413]).toContain(res.status);
      });
  });
});