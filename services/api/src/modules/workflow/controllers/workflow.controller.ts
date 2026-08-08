import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CreateWorkflowDto } from '../dto/create-workflow.dto';
import { WorkflowResponseDto } from '../dto/workflow-response.dto';
import { WorkflowValidationResponseDto } from '../dto/workflow-validation-response.dto';
import { WorkflowCreationService } from '../services/workflow-creation.service';
import { WorkflowValidationService } from '../services/workflow-validation.service';
import { WorkflowPublicationService } from '../services/workflow-publication.service';
import { WorkflowQueryService } from '../services/workflow-query.service';
import { ExecutionEngine } from '../../execution/services/execution-engine.service';
import { Get, Post, HttpCode, HttpStatus, Param, Body, Controller } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateWorkflowDto } from '../dto/create-workflow.dto';
import { WorkflowResponseDto } from '../dto/workflow-response.dto';
import { WorkflowValidationResponseDto } from '../dto/workflow-validation-response.dto';

@ApiTags('workflows')
@Controller('workflows')
export class WorkflowController {
  constructor(
    private readonly workflowCreationService: WorkflowCreationService,
    private readonly workflowValidationService: WorkflowValidationService,
    private readonly workflowPublicationService: WorkflowPublicationService,
    private readonly workflowQueryService: WorkflowQueryService,
    private readonly executionEngine: ExecutionEngine,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all workflows' })
  @ApiResponse({ status: 200, description: 'List of all workflows.' })
  findAll() {
    return this.workflowQueryService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a workflow by ID' })
  @ApiResponse({ status: 200, description: 'The workflow details.' })
  findOne(@Param('id') id: string) {
    return this.workflowQueryService.findOne(id);
  }

  @Post(':id/execute')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Execute a published workflow' })
  @ApiResponse({ status: 201, description: 'The workflow run.' })
  execute(@Param('id') id: string) {
    return this.executionEngine.startWorkflow(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new workflow definition' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The workflow has been successfully created.',
    type: WorkflowResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data.',
  })
  create(@Body() dto: CreateWorkflowDto) {
    return this.workflowCreationService.create(dto);
  }

  @Post(':id/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate a draft workflow' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The validation results of the workflow.',
    type: WorkflowValidationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Workflow not found.',
  })
  validate(@Param('id') id: string) {
    return this.workflowValidationService.validate(id);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a validated workflow' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The workflow has been successfully published.',
    type: WorkflowResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Workflow must be validated before publication.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Workflow not found.',
  })
  publish(@Param('id') id: string) {
    return this.workflowPublicationService.publish(id);
  }
}
