import { Workflow } from '../entities/workflow.entity';

export const WORKFLOW_REPOSITORY = 'WORKFLOW_REPOSITORY';

export interface WorkflowRepository {
  save(workflow: Workflow): Promise<Workflow>;
  findById(id: string): Promise<Workflow | null>;
  update(id: string, workflow: Partial<Workflow>): Promise<Workflow>;
  delete(id: string): Promise<boolean>;
}
