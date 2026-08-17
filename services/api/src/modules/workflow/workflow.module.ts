import { Module } from '@nestjs/common';

import { WorkflowController } from './controllers/workflow.controller';
import { WorkflowCreationService } from './services/workflow-creation.service';
import { WorkflowUpdateService } from './services/workflow-update.service';
import { WorkflowValidationService } from './services/workflow-validation.service';
import { WorkflowPublicationService } from './services/workflow-publication.service';
import { WorkflowQueryService } from './services/workflow-query.service';
import { WORKFLOW_REPOSITORY } from './repositories/workflow.repository';
import { PrismaWorkflowRepository } from './repositories/prisma-workflow.repository';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';

import { ExecutionModule } from '../execution/execution.module';
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [PrismaModule, forwardRef(() => ExecutionModule)],
  controllers: [WorkflowController],
  providers: [
    WorkflowCreationService,
    WorkflowUpdateService,
    WorkflowValidationService,
    WorkflowPublicationService,
    WorkflowQueryService,
    {
      provide: WORKFLOW_REPOSITORY,
      useClass: PrismaWorkflowRepository,
    },
  ],
  exports: [WORKFLOW_REPOSITORY],
})
export class WorkflowModule {}
