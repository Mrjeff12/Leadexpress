import pino from 'pino';

export const logger = pino({
  name: 'wa-listener',
  level: process.env.LOG_LEVEL ?? 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
});
