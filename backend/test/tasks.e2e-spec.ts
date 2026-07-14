// ADLAAAA-25 — Slice 5 Tasks CRUD + Activity Log + Progress % API e2e.
// Demo: PM creates task, member updates status → activity entry written;
//        project progress % recalculates; RBAC blocks non-member.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma';

describe('Tasks CRUD + Activity Log + Progress % (e2e) — ADLAAAA-25', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const pmEmail = 'e2e-tasks-pm@example.com';
  const pmPassword = 'PmTask3!';
  const memberEmail = 'e2e-tasks-member@example.com';
  const memberPassword = 'MbrTask3!';
  const outsiderEmail = 'e2e-tasks-outsider@example.com';
  const outsiderPassword = 'OutTask3!';

  let pmToken: string;
  let memberToken: string;
  let outsiderToken: string;
  let memberId: string;
  let projectId: string;
  let taskId: string;

  const cleanup = async () => {
    for (const email of [pmEmail, memberEmail, outsiderEmail]) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        await prisma.activityLog.deleteMany({ where: { project: { ownerId: user.id } } });
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

    const [pm, member] = await Promise.all([
      prisma.user.create({
        data: {
          email: pmEmail,
          passwordHash: pmHash,
          fullName: 'E2E Tasks PM',
          role: UserRole.ProjectManager,
          isActive: true,
          mustResetPw: false,
        },
      }),
      prisma.user.create({
        data: {
          email: memberEmail,
          passwordHash: memberHash,
          fullName: 'E2E Tasks Member',
          role: UserRole.Member,
          isActive: true,
          mustResetPw: false,
        },
      }),
      prisma.user.create({
        data: {
          email: outsiderEmail,
          passwordHash: outsiderHash,
          fullName: 'E2E Tasks Outsider',
          role: UserRole.Member,
          isActive: true,
          mustResetPw: false,
        },
      }),
    ]);

    memberId = member.id;
    void pm;

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

  // Setup: PM creates project and adds member
  it('PM creates a project', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ name: 'Task E2E Project', description: 'Slice 5 e2e' })
      .expect(201);

    expect(res.body.id).toBeDefined();
    projectId = res.body.id as string;
  });

  it('PM adds member to project', async () => {
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ userId: memberId })
      .expect(201);
  });

  // Task CRUD
  it('PM creates a task (ToDo)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ title: 'E2E Task', priority: 'Medium', status: 'ToDo' })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.title).toBe('E2E Task');
    expect(res.body.status).toBe('ToDo');
    taskId = res.body.id as string;
  });

  it('PM lists tasks and sees the new task', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((t: { id: string }) => t.id === taskId)).toBe(true);
  });

  it('outsider cannot list tasks (403)', async () => {
    await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('member updates task status to Done → activity log entry created', async () => {
    // Member changes status → StatusChanged activity entry
    await request(app.getHttpServer())
      .patch(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ status: 'Done', assigneeId: memberId })
      .expect(200);

    // Fetch task detail and verify activity log
    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    const logs: Array<{ action: string; detail: unknown }> = res.body.activityLogs;
    expect(Array.isArray(logs)).toBe(true);
    const statusLog = logs.find((l) => l.action === 'StatusChanged');
    expect(statusLog).toBeDefined();
    expect((statusLog!.detail as { from: string; to: string }).from).toBe('ToDo');
    expect((statusLog!.detail as { from: string; to: string }).to).toBe('Done');
  });

  it('project progress % reflects Done task', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);

    // 1 of 1 tasks Done → 100%
    expect(res.body.progress).toBe(100);
  });

  it('member cannot edit a task they neither created nor are assigned to', async () => {
    // Create a second task that member is not assigned to
    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ title: 'PM-only task', priority: 'Low', status: 'ToDo' })
      .expect(201);

    const otherTaskId = res.body.id as string;

    // Member tries to update (not creator, not assignee)
    await request(app.getHttpServer())
      .patch(`/api/projects/${projectId}/tasks/${otherTaskId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ title: 'Hijacked' })
      .expect(403);
  });

  it('task create generates TaskCreated activity entry', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);

    const logs: Array<{ action: string }> = res.body.activityLogs;
    expect(logs.some((l) => l.action === 'TaskCreated')).toBe(true);
  });

  it('PM can delete a task', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ title: 'To be deleted', priority: 'Low', status: 'ToDo' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/projects/${projectId}/tasks/${res.body.id}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);
  });
});
