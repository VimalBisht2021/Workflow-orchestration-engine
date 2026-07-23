import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';

import { CreateWorkflowDto } from '../dto/create-workflow.dto';
import { WorkflowCreationService } from '../services/workflow-creation.service';
import { WorkflowValidationService } from '../services/workflow-validation.service';
import { WorkflowPublicationService } from '../services/workflow-publication.service';

@Controller('workflows')
export class WorkflowController {
  constructor(
    private readonly workflowCreationService: WorkflowCreationService,
    private readonly workflowValidationService: WorkflowValidationService,
    private readonly workflowPublicationService: WorkflowPublicationService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateWorkflowDto) {
    return this.workflowCreationService.create(dto);
  }

  @Post(':id/validate')
  @HttpCode(HttpStatus.OK)
  validate(@Param('id') id: string) {
    return this.workflowValidationService.validate(id);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  publish(@Param('id') id: string) {
    return this.workflowPublicationService.publish(id);
  }
}
