import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  name: process.env.APP_NAME ?? 'workflow-api',
  port: parseInt(process.env.PORT ?? '3000', 10),
  environment: process.env.NODE_ENV ?? 'development',
}));

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL!,
}));

export default [appConfig, databaseConfig];
