import { Injectable } from '@nestjs/common';
import { Workflow } from '../entities/workflow.entity';
import { WorkflowRepository } from './workflow.repository';

@Injectable()
export class InMemoryWorkflowRepository implements WorkflowRepository {
  private readonly workflows = new Map<string, Workflow>();

  save(workflow: Workflow): Promise<Workflow> {
    this.workflows.set(workflow.id, workflow);
    return Promise.resolve(workflow);
  }

  findById(id: string): Promise<Workflow | null> {
    return Promise.resolve(this.workflows.get(id) || null);
  }

  async update(id: string, partial: Partial<Workflow>): Promise<Workflow> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Workflow with id ${id} not found`);
    }

    const updated = { ...existing, ...partial };
    this.workflows.set(id, updated);
    return updated;
  }

  delete(id: string): Promise<boolean> {
    return Promise.resolve(this.workflows.delete(id));
  }
}
