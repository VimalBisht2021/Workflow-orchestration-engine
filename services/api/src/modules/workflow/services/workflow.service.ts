import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';

import { CreateWorkflowDto } from '../dto/create-workflow.dto';
import { WorkflowResponseDto } from '../dto/workflow-response.dto';

@Injectable()
export class WorkflowService {
  create(dto: CreateWorkflowDto): WorkflowResponseDto {
    return {
      id: uuid(),
      name: dto.name,
      description: dto.description,
      owner: dto.owner,
      tags: dto.tags ?? [],
      version: 1,
      createdAt: new Date().toISOString(),
    };
  }
}
