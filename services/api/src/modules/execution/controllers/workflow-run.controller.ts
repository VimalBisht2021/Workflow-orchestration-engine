import {
  Controller,
  Post,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ReplayService } from '../services/replay.service';
import type { WorkflowRunRepository } from '../repositories/workflow-run.repository';
import { WORKFLOW_RUN_REPOSITORY } from '../repositories/workflow-run.repository';

@ApiTags('workflow-runs')
@Controller('workflow-runs')
export class WorkflowRunController {
  private readonly logger = new Logger(WorkflowRunController.name);

  constructor(
    private readonly replayService: ReplayService,
    @Inject(WORKFLOW_RUN_REPOSITORY)
    private readonly workflowRunRepository: WorkflowRunRepository,
  ) {}

  @Post(':id/replay')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Replay a terminal workflow run' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The workflow run has been successfully replayed.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Workflow run not found.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Workflow run is not in a terminal state.',
  })
  async replay(@Param('id') id: string) {
    this.logger.log(`Received replay request for WorkflowRun: ${id}`);

    try {
      const newRun = await this.replayService.replayWorkflow(id);
      return {
        message: 'Workflow run replayed successfully',
        newRunId: newRun.id,
        replayedFromId: id,
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Failed to replay WorkflowRun ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get(':id/lineage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get the replay lineage chain for a workflow run' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Returns the ordered replay chain from oldest ancestor to the given run.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Workflow run not found.',
  })
  async getLineage(@Param('id') id: string) {
    this.logger.log(`Received lineage request for WorkflowRun: ${id}`);

    const chain = await this.workflowRunRepository.findReplayChain(id);
    if (chain.length === 0) {
      throw new NotFoundException(`WorkflowRun ${id} not found`);
    }

    return {
      workflowRunId: id,
      chainLength: chain.length,
      lineage: chain.map((run) => ({
        id: run.id,
        workflowId: run.workflowId,
        workflowVersion: run.workflowVersion,
        status: run.status,
        replayedFromId: run.replayedFromId ?? null,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        createdAt: run.createdAt,
      })),
    };
  }
}
