import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  getHealth() {
    return {
      status: 'UP',
      service: 'workflow-api',
      timestamp: new Date().toISOString(),
    };
  }
}
