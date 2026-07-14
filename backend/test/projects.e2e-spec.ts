import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma';

// ADLAAAA-24 — Slice 4 Projects CRUD + Members + ProjectMemberGuard E2E.
// Demo: PM creates project, adds member, changes status, archives;
//        non-member gets 403 on GET /projects/:id.
describe('Projects CRUD + Members + ProjectMemberGuard (e2e) — ADLAAAA-24', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const pmEmail = 'e2e-proj-pm@example.com';
  const pmPassword = 'PmS3cur3!';
  const memberEmail = 'e2e-proj-member@example.com';
  const memberPassword = 'MbrS3cur3!';
  const outsiderEmail = 'e2e-proj-outsider@example.com';
  const outsiderPassword = 'OutS3cur3!';

  let pmToken: string;
  let memberToken: string;
  let outsiderToken: string;
  let memberId: string;
  let projectId: string;

  const cleanup = async () => {
    for (const email of [pmEmail, memberEmail, outsiderEmail]) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        await prisma.taskActivity.deleteMany({ where: { task: { project: { ownerId: user.id } } } });
        await prisma.task.deleteMany({ where: { project: { ownerId: user.id } } });
        await prisma.projectMember.deleteMany({ where: { project: { ownerId: user.id } } });
        await prisma.project.deleteMany({ where: { ownerId: user.id } });
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

    const hash = (pw: string) => bcrypt.hash(pw, 12);

    const [pmHash, memberHash, outsiderHash] = await Promise.all([
      hash(pmPassword),
      hash(memberPassword),
      hash(outsiderPassword),
    ]);

    const [pm, member, outsider] = await Promise.all([
      prisma.user.create({
        data: {
          email: pmEmail,
          passwordHash: pmHash,
          fullName: 'E2E PM User',
          role: UserRole.ProjectManager,
          isActive: true,
          mustResetPw: false,
        },
      }),
      prisma.user.create({
        data: {
          email: memberEmail,
          passwordHash: memberHash,
          fullName: 'E2E Member User',
          role: UserRole.Member,
          isActive: true,
          mustResetPw: false,
        },
      }),
      prisma.user.create({
        data: {
          email: outsiderEmail,
          passwordHash: outsiderHash,
          fullName: 'E2E Outsider User',
          role: UserRole.Member,
          isActive: true,
          mustResetPw: false,
        },
      }),
    ]);

    memberId = member.id;
    void outsider; // used only via token

    const login = async (email: string, password: string) => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password })
        .expect(201);
      return res.body.accessToken as string;
    };

    [pmToken, memberToken, outsiderToken] = await Promise.all([
      login(pmEmail, pmPassword),
      login(memberEmail, memberPassword),
      login(outsiderEmail, outsiderPassword),
    ]);
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('PM creates a project', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ name: 'E2E Test Project', description: 'Created in Slice 4 e2e' })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('E2E Test Project');
    projectId = res.body.id as string;
  });

  it('PM can list own projects', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/projects')
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((p: { id: string }) => p.id === projectId)).toBe(true);
  });

  it('PM can get project detail', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);

    expect(res.body.id).toBe(projectId);
  });

  it('non-member (outsider) gets 403 on GET /projects/:id', async () => {
    await request(app.getHttpServer())
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('PM adds a member to the project', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ userId: memberId })
      .expect(201);

    expect(res.body.userId).toBe(memberId);
  });

  it('member can now access project detail', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(res.body.id).toBe(projectId);
  });

  it('PM changes project status to Active', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/projects/${projectId}/status`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ status: 'Active' })
      .expect(200);

    expect(res.body.status).toBe('Active');
  });

  it('PM archives the project', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/projects/${projectId}/archive`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ archive: true })
      .expect(200);

    expect(res.body.isArchived).toBe(true);
  });

  it('archived project appears in list when archived=true', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/projects?archived=true')
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);

    const found = (res.body as Array<{ id: string; isArchived: boolean }>).find(
      (p) => p.id === projectId,
    );
    expect(found).toBeDefined();
    expect(found?.isArchived).toBe(true);
  });

  it('PM removes the member', async () => {
    await request(app.getHttpServer())
      .delete(`/api/projects/${projectId}/members/${memberId}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);
  });

  it('removed member gets 403 on GET /projects/:id', async () => {
    await request(app.getHttpServer())
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
  });
});
