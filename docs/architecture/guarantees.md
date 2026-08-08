# Architectural Guarantees

This document formally tracks the core resilience and integrity guarantees of the platform, the mechanism that enforces them, and the empirical evidence verifying their implementation.

---

### Guarantee 1: A TaskRun executes at most once per attempt.
- **Mechanism**: Optimistic Concurrency Control (OCC) using versioned rows in PostgreSQL, combined with Redis locking during execution.
- **Verified By**: 
  - Chaos Report 001 (Scheduler Split-Brain)
  - Performance Report 002

### Guarantee 2: Duplicate webhooks cannot mutate workflow state.
- **Mechanism**: The `ProcessedWebhookEvent` idempotent table ensures that a specific webhook correlation ID can only transition a TaskRun state once.
- **Verified By**: 
  - Chaos Report 004 (Duplicate Delivery)

### Guarantee 3: Schedulers cannot corrupt active execution.
- **Mechanism**: The Scheduler only recovers tasks whose heartbeat `lastPingAt` is older than the timeout threshold. OCC prevents a worker and a scheduler from simultaneously updating a task.
- **Verified By**:
  - Chaos Report 002 (Worker SIGKILL)

### Guarantee 4: The Control Plane is decoupled from Execution Plane failures.
- **Mechanism**: The `execution-sdk` acts as an anti-corruption layer. If DTP goes offline, WOE gracefully pauses dispatching (circuit breaker) and queues dispatches internally.
- **Verified By**:
  - Chaos Report 005 (Redis Restart)
