import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { CreateWorkflowDto } from '../dto/create-workflow.dto';
import { WorkflowService } from '../services/workflow.service';

@Controller('workflows')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateWorkflowDto) {
    return this.workflowService.create(dto);
  }
}
