import { WorkflowStatus } from '../enums/workflow-status.enum';

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  owner: string;
  tags: string[];
  version: number;
  status: WorkflowStatus;
  createdAt: Date;
}
