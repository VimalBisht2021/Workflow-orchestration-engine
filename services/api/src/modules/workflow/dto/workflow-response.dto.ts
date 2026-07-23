export class WorkflowResponseDto {
  id: string;

  name: string;

  description?: string;

  owner: string;

  tags: string[];

  version: number;

  createdAt: string;
}
