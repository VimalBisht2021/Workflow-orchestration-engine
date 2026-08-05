# Workflow Orchestration Engine Architecture

This document describes the foundational architecture of the Workflow Orchestration Engine. It outlines the domain boundaries, execution lifecycle, internal state machines, event flow, failure semantics, and how to extend the system.

---

## 1. High-Level Architecture

The system is built as a modular monolith using **NestJS**, structured around **Domain-Driven Design (DDD)** principles. It strictly separates business logic (the Domain) from infrastructure concerns (the Database, Message Brokers).

The architecture enforces a clear **Control Plane / Execution Plane** separation:

- **Workflow Orchestration Engine (WOE)** — Control Plane. Owns workflow definitions, DAG evaluation, state reconciliation, and replay.
- **Distributed Task Platform (DTP)** — Execution Plane (separate repository). Owns task execution, retries, worker management, and resource allocation.

### Key Layers & Domains

1.  **Definition Domain (`src/modules/workflow`)**
    - **Responsibility**: Defines the templates for workflows and tasks.
    - **Core Entities**: `Workflow`, `TaskDefinition`.
    - **Behavior**: Workflows are immutable once published. Modifications create new versions.
2.  **Runtime Domain (`src/modules/execution`)**
    - **Responsibility**: Manages the instances of executing workflows and tasks.
    - **Core Entities**: `WorkflowRun`, `TaskRun`.
    - **Behavior**: Exposes rich domain models containing strict state-transition guards (e.g., `taskRun.schedule()`, `workflowRun.complete()`).
3.  **Execution Engine (`src/modules/execution/services/execution-engine.service.ts`)**
    - **Responsibility**: The central orchestrator. Evaluates the Directed Acyclic Graph (DAG) of tasks, determines which tasks are ready, and dispatches them.
    - **Behavior**: Operates entirely on Domain Events (e.g., `TaskCompletedDomainEvent`). It knows _when_ to execute tasks, but not _how_ they are executed.
4.  **Execution API Contract (`src/modules/execution/contracts/execution-api-contract.ts`)**
    - **Responsibility**: Defines the versioned interface between WOE and DTP.
    - **Dispatch**: `ExecutionApiV1DispatchRequest` — WOE sends this to DTP.
    - **Callback**: `ExecutionApiV1WebhookEvent` — DTP sends this back to WOE.
5.  **Distributed Infrastructure**
    - **Database**: PostgreSQL via Prisma ORM, abstracted behind Repository interfaces.
    - **Task Execution**: Delegated to DTP via the `TaskExecutionGateway` interface.

---

## 2. Execution Lifecycle

The lifecycle of an execution flows from definition snapshotting to terminal completion:

1.  **Instantiation**: A client calls `ExecutionEngine.startWorkflow(workflowId)`.
2.  **Version Snapshotting**: The `WorkflowRunFactory` retrieves the current published version of the `Workflow` and instantiates a `WorkflowRun` and a complete graph of `TaskRun` entities in the `PENDING` state. The `workflowVersion` is explicitly saved on the `WorkflowRun` to guarantee immutability (future edits to the workflow definition do not affect running instances).
3.  **Persistence**: The initialized graph is saved transactionally via the Repositories.
4.  **Bootstrap Event**: The Engine publishes a `WorkflowStartedDomainEvent`.
5.  **Reconciliation**: The Engine listens to its own domain events. Upon `WorkflowStartedDomainEvent`, it calls `reconcile()`, evaluating which tasks have no dependencies and transitions them from `PENDING` to `SCHEDULED`.
6.  **Dispatch**: The Engine constructs a versioned `ExecutionApiV1DispatchRequest` containing the handler, input, retry policy, timeout, correlation ID, and capabilities. This is sent through the `TaskExecutionGateway` to the DTP.
7.  **Async Execution**: DTP executes the task, manages retries internally, and reports the terminal result back to WOE via an authenticated webhook event.
8.  **Callback**: The `WebhookController` validates the event signature, checks idempotency, updates the `TaskRun` state, and emits a Domain Event to trigger the next reconciliation cycle.

---

## 3. State Machines

Both `WorkflowRun` and `TaskRun` entities govern their own state transitions. Invalid transitions throw `InvalidStateTransitionException` domain errors.

### WorkflowRun State Machine

```text
PENDING ───> RUNNING ──┬──> COMPLETED
                       ├──> FAILED
                       └──> CANCELLED
```

### TaskRun State Machine

```text
PENDING ───> SCHEDULED ───> RUNNING ──┬──> COMPLETED
                                      ├──> FAILED
                                      └──> SKIPPED
```

_Note: Retries are entirely owned by the Distributed Task Platform (DTP). WOE only observes the terminal outcome (`COMPLETED` or `FAILED`) regardless of how many attempts DTP made internally. Retry policy (`maxRetries`, `backoffStrategy`, `retryDelayMs`) is defined on `TaskDefinition` and passed to DTP at dispatch time._

---

## 4. Event Flow

The system employs Event-Driven Orchestration. The engine reacts to state changes rather than polling for them.

1.  **Domain Events** (`src/modules/execution/events/domain`):
    Internal events emitted by the `ExecutionEngine` to itself (using `@nestjs/event-emitter`). Examples: `TaskCompletedDomainEvent`, `TaskFailedDomainEvent`.
2.  **Webhook Events** (`POST /api/webhooks/tasks/events`):
    External events received from DTP via an authenticated HTTP endpoint. The webhook controller validates the HMAC-SHA256 signature, checks version consistency, ensures idempotency via the `ProcessedWebhookEvent` table, and translates the callback into a Domain Event for the engine.
3.  **Integration Events** (`src/modules/events/integration`):
    Bridge layer that translates incoming integration events into Domain Events.

### Execution Loop

```text
Engine Dispatches Task → DTP
  ──> DTP Executes (with retries)
  ──> DTP Posts Webhook Event
  ──> WebhookController Validates & Persists
  ──> Domain Event Published
  ──> Execution Engine Reconciles DAG
  ──> Engine Dispatches Next Ready Tasks
  ──> (Cycle repeats)
```

---

## 5. Failure Semantics

Robust distributed systems require explicit failure handling mechanisms:

- **Atomic Scheduling**: During reconciliation, the engine uses optimistic concurrency (via Prisma `updateMany` where `status = PENDING`) to transition a task to `SCHEDULED`. This guarantees a task is scheduled **at most once**, even if multiple dependencies complete at the exact same millisecond and trigger concurrent reconciliations.
- **Retry Delegation**: Retry policy is defined on `TaskDefinition` and passed to DTP during dispatch. DTP owns retry execution and only reports the terminal result to WOE. WOE never sees intermediate retry states.
- **Webhook Idempotency**: Processed `eventId`s are stored in the `ProcessedWebhookEvent` table. Duplicate callbacks are safely ignored even after WOE restarts.
- **Webhook Authentication**: Callbacks are authenticated via HMAC-SHA256 signature (`X-Signature` header). Unauthorized status updates are rejected.
- **Version Consistency**: Webhook events must include the correct `workflowVersion`. Stale or mismatched version callbacks are rejected.
- **Duplicate Delivery**: If the engine receives duplicate `TaskCompletedDomainEvent`s, it ignores them if the task is already in a terminal state.
- **Correlation IDs**: An immutable `correlationId` is generated per `WorkflowRun` and propagates through the dispatch request, webhook events, and logs to trace distributed execution.

---

## 6. Replay

Workflow replay creates a new `WorkflowRun` from a terminal (failed/completed/cancelled) run:

| Original Status | Replayed Status |
| --------------- | --------------- |
| COMPLETED       | COMPLETED       |
| SKIPPED         | SKIPPED         |
| FAILED          | PENDING         |

Replay preserves historical outputs, timestamps, and execution metadata. The original run is never mutated. Lineage is tracked via `replayedFromId`, enabling replay chain reconstruction.

---

## 7. Extension Points

The architecture is highly decoupled, offering several primary extension points:

### 1. Adding New Task Handlers

Register handlers in the DTP worker registry. WOE only needs the handler name in `TaskDefinition`.

### 2. Changing the Task Execution Transport

Currently, the system uses `RemoteTaskExecutionGateway` (HTTP against mock DTP). You can swap this with a gRPC, Kafka, or NATS implementation by creating a new class that implements `TaskExecutionGateway` and overriding the `TASK_EXECUTION_GATEWAY` provider in NestJS dependency injection. No orchestration code changes.

### 3. Capability Negotiation

The `ExecutionApiV1DispatchRequest` includes a `capabilities` map for future DTP features (GPU workers, priorities, batch execution) without changing the contract.

### 4. Failure Strategies

Implement the `FailureStrategy` interface to customize what happens when a workflow encounters an unrecoverable failure (e.g., triggering a webhook, paging an on-call engineer, or rolling back compensating transactions).
