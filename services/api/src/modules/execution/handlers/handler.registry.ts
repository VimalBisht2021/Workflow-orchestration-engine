import { Injectable } from '@nestjs/common';
import { TaskHandler } from './task-handler.interface';

@Injectable()
export class HandlerRegistry {
  private handlers = new Map<string, TaskHandler>();

  register(handler: TaskHandler): void {
    const name = handler.getName();
    if (this.handlers.has(name)) {
      throw new Error(`Handler for ${name} is already registered.`);
    }
    this.handlers.set(name, handler);
  }

  has(name: string): boolean {
    return this.handlers.has(name);
  }

  resolve(name: string): TaskHandler {
    const handler = this.handlers.get(name);
    if (!handler) {
      throw new Error(`Handler for ${name} not found in registry.`);
    }
    return handler;
  }
}
