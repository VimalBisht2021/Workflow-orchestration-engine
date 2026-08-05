import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { configuration, validationSchema } from './config';

import { HealthModule } from './modules/health/health.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { ExecutionModule } from './modules/execution/execution.module';
import { ObservabilityModule } from './modules/observability/observability.module';
import { SystemModule } from './modules/system/system.module';
import { EventsModule } from './modules/events/events.module';
import { LoggerModule } from 'nestjs-pino';
import { AsyncLocalStorage } from 'async_hooks';

export const loggingAls = new AsyncLocalStorage<Record<string, any>>();
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
      load: configuration,
      validationSchema,
    }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    RedisModule,
    HealthModule,
    WorkflowModule,
    ExecutionModule,
    ObservabilityModule,
    SystemModule,
    EventsModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty' }
            : undefined,
        mixin() {
          const store = loggingAls.getStore();
          return store ? { ...store } : {};
        },
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
