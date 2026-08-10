import { Module, forwardRef } from '@nestjs/common';
import { WorkflowModule } from '../workflow/workflow.module';
import { ExecutionEngine } from './services/execution-engine.service';
import { DependencyResolver } from './services/dependency-resolver.service';
import { WorkflowRunFactory } from './services/workflow-run.factory';
import { HandlerRegistry } from './handlers/handler.registry';
import { TASK_EXECUTION_GATEWAY } from './dispatchers/task-execution-gateway.interface';
import { RemoteTaskExecutionGateway } from './dispatchers/remote-task-execution-gateway';
import { FailFastStrategy } from './services/fail-fast.strategy';
import { FAILURE_STRATEGY } from './services/failure-strategy.interface';
import { NestDomainEventPublisher } from './events/domain/nest-domain-event-publisher';
import { DOMAIN_EVENT_PUBLISHER } from './events/domain/domain-event-publisher.interface';
import { PrismaWorkflowRunRepository } from './repositories/prisma-workflow-run.repository';
import { WORKFLOW_RUN_REPOSITORY } from './repositories/workflow-run.repository';
import { PrismaTaskRunRepository } from './repositories/prisma-task-run.repository';
import { TASK_RUN_REPOSITORY } from './repositories/task-run.repository';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { ReplayService } from './services/replay.service';
import { WebhookController } from './controllers/webhook.controller';
import { WorkflowRunController } from './controllers/workflow-run.controller';
import { ReconciliationService } from './services/reconciliation.service';

@Module({
  imports: [PrismaModule, forwardRef(() => WorkflowModule)],
  controllers: [WebhookController, WorkflowRunController],
  providers: [
    ExecutionEngine,
    DependencyResolver,
    WorkflowRunFactory,
    HandlerRegistry,
    {
      provide: TASK_EXECUTION_GATEWAY,
      useClass: RemoteTaskExecutionGateway,
    },
    {
      provide: FAILURE_STRATEGY,
      useClass: FailFastStrategy,
    },
    {
      provide: DOMAIN_EVENT_PUBLISHER,
      useClass: NestDomainEventPublisher,
    },
    {
      provide: WORKFLOW_RUN_REPOSITORY,
      useClass: PrismaWorkflowRunRepository,
    },
    {
      provide: TASK_RUN_REPOSITORY,
      useClass: PrismaTaskRunRepository,
    },
    ReplayService,
    ReconciliationService,
  ],
  exports: [
    ExecutionEngine,
    WORKFLOW_RUN_REPOSITORY,
    TASK_RUN_REPOSITORY,
    DOMAIN_EVENT_PUBLISHER,
    HandlerRegistry,
  ],
})
export class ExecutionModule {}
