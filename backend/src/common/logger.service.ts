import { Injectable, ConsoleLogger } from '@nestjs/common';
import pino from 'pino';

const sensitivePaths = [
  'authorization',
  'cookie',
  'set-cookie',
  'password',
  'passwordHash',
  'token',
  'refreshToken',
  'accessToken',
  'jwt',
  'secret',
];

const pinoLogger = pino({
  redact: {
    paths: sensitivePaths,
    censor: '[REDACTED]',
  },
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino/file', options: { destination: 1 } }
      : undefined,
});

@Injectable()
export class LoggerService extends ConsoleLogger {
  log(message: any, context?: string) {
    pinoLogger.info({ context }, message);
  }
  error(message: any, trace?: string, context?: string) {
    pinoLogger.error({ context, trace }, message);
  }
  warn(message: any, context?: string) {
    pinoLogger.warn({ context }, message);
  }
  debug(message: any, context?: string) {
    pinoLogger.debug({ context }, message);
  }
  verbose(message: any, context?: string) {
    pinoLogger.trace({ context }, message);
  }
}