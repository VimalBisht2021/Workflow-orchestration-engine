import { Module } from '@nestjs/common';

import { WorkflowController } from './controllers/workflow.controller';
import { WorkflowCreationService } from './services/workflow-creation.service';
import { WorkflowValidationService } from './services/workflow-validation.service';
import { WorkflowPublicationService } from './services/workflow-publication.service';
import { WORKFLOW_REPOSITORY } from './repositories/workflow.repository';
import { InMemoryWorkflowRepository } from './repositories/in-memory-workflow.repository';

@Module({
  controllers: [WorkflowController],
  providers: [
    WorkflowCreationService,
    WorkflowValidationService,
    WorkflowPublicationService,
    {
      provide: WORKFLOW_REPOSITORY,
      useClass: InMemoryWorkflowRepository,
    },
  ],
})
export class WorkflowModule {}
