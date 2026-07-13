import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import {
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma';

// ADLAAAA-21 — Slice 1 Auth API test: register / login / refresh / logout.
// Uses a small stateful Prisma mock so refresh-token rotation and revocation
// (persisted, hashed at rest) can be exercised without a live database.
describe('AuthService (ADLAAAA-21)', () => {
  let service: AuthService;

  // In-memory stores standing in for the users / refresh_tokens tables.
  let users: any[];
  let tokens: any[];
  let idSeq: number;

  // Captures the raw (unhashed) refresh cookie value the service sets, so a
  // caller can present it back on refresh/logout the way a browser would.
  let lastCookie: string | undefined;
  const res: any = {
    cookie: jest.fn((name: string, value: string) => {
      lastCookie = value;
    }),
    clearCookie: jest.fn(),
  };

  const prismaMock = {
    user: {
      findUnique: jest.fn(({ where }: any) =>
        Promise.resolve(
          users.find(
            (u) => u.email === where.email || u.id === where.id,
          ) ?? null,
        ),
      ),
      create: jest.fn(({ data }: any) => {
        const user = {
          id: `user-${idSeq++}`,
          role: UserRole.MEMBER,
          isActive: true,
          mustResetPw: false,
          ...data,
        };
        users.push(user);
        return Promise.resolve(user);
      }),
    },
    refreshToken: {
      create: jest.fn(({ data }: any) => {
        const token = { id: `rt-${idSeq++}`, revokedAt: null, ...data };
        tokens.push(token);
        return Promise.resolve(token);
      }),
      findFirst: jest.fn(({ where }: any) => {
        const t = tokens.find(
          (t) => t.tokenHash === where.tokenHash && t.revokedAt === null,
        );
        if (!t) return Promise.resolve(null);
        return Promise.resolve({
          ...t,
          user: users.find((u) => u.id === t.userId),
        });
      }),
      update: jest.fn(({ where, data }: any) => {
        const t = tokens.find((t) => t.id === where.id);
        if (t) Object.assign(t, data);
        return Promise.resolve(t);
      }),
      updateMany: jest.fn(({ where, data }: any) => {
        let count = 0;
        tokens
          .filter(
            (t) => t.tokenHash === where.tokenHash && t.revokedAt === null,
          )
          .forEach((t) => {
            Object.assign(t, data);
            count++;
          });
        return Promise.resolve({ count });
      }),
    },
  };

  beforeEach(async () => {
    users = [];
    tokens = [];
    idSeq = 1;
    lastCookie = undefined;
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: JwtService,
          useValue: { sign: jest.fn(() => 'signed.access.token') },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  const creds = {
    email: 'alice@example.com',
    password: 'S3cur3P@ss',
    fullName: 'Alice Smith',
  };

  it('register: hashes the password (bcrypt) and issues tokens', async () => {
    const result = await service.register(creds, res);

    expect(result.accessToken).toBe('signed.access.token');
    expect(result.expiresIn).toBe(900); // 15 min access token
    expect(users).toHaveLength(1);
    // Password is hashed, never stored in plaintext.
    expect(users[0].passwordHash).not.toBe(creds.password);
    expect(await bcrypt.compare(creds.password, users[0].passwordHash)).toBe(
      true,
    );
    // Refresh token persisted hashed at rest, raw value only in the cookie.
    expect(tokens).toHaveLength(1);
    expect(tokens[0].tokenHash).not.toBe(lastCookie);
    expect(res.cookie).toHaveBeenCalledWith(
      'refresh_token',
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('register: rejects a duplicate email', async () => {
    await service.register(creds, res);
    await expect(service.register(creds, res)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('login: succeeds with correct credentials, fails otherwise', async () => {
    await service.register(creds, res);

    const ok = await service.login(
      { email: creds.email, password: creds.password },
      res,
    );
    expect(ok.accessToken).toBe('signed.access.token');

    await expect(
      service.login({ email: creds.email, password: 'wrong-pass' }, res),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    await expect(
      service.login({ email: 'nobody@example.com', password: 'x' }, res),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refresh: rotates the token — old one is revoked, new one issued', async () => {
    await service.register(creds, res);
    const firstRefresh = lastCookie!;

    const rotated = await service.refresh(firstRefresh, res);
    expect(rotated.accessToken).toBe('signed.access.token');

    // A brand-new refresh token was set (rotation).
    expect(lastCookie).not.toBe(firstRefresh);
    // The original token is now revoked and cannot be reused.
    await expect(service.refresh(firstRefresh, res)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refresh: rejects a missing token', async () => {
    await expect(service.refresh(undefined, res)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('logout: revokes the refresh token and clears the cookie', async () => {
    await service.register(creds, res);
    const refresh = lastCookie!;

    const result = await service.logout(refresh, res);
    expect(result.message).toBe('Logged out');
    expect(res.clearCookie).toHaveBeenCalledWith('refresh_token');

    // Token is revoked — a subsequent refresh must fail.
    await expect(service.refresh(refresh, res)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
