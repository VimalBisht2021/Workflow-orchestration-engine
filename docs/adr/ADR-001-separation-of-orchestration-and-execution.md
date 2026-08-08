# ADR-001: Separation of Orchestration and Execution

## Status
Accepted

## Context
Orchestrating complex DAG-based workflows involves deep state tracking, lineage preservation, and resolving dependencies. Executing individual tasks involves managing compute resources, handling transient network faults, queueing, and distributed race conditions.

Historically, orchestration engines couple these two responsibilities. This coupling leads to a monolith where a spike in task execution (e.g., thousands of queued jobs) can overload the control plane, causing the orchestration engine itself (UI, API, DAG resolution) to become unresponsive or crash.

## Decision
We will physically and logically separate the system into two distinct planes:
1. **Workflow Orchestration Engine (WOE)**: Acts as the Control Plane. It owns the workflow definitions, resolves the DAG, and dispatches tasks. It never executes arbitrary code.
2. **Distributed Task Platform (DTP)**: Acts as the Execution Plane. It owns workers, queues, and task scheduling. It has no knowledge of DAGs, workflows, or dependencies.

## Consequences
- **Positive**: The control plane remains highly available even if the execution plane is backlogged.
- **Positive**: The execution plane can be scaled horizontally and tuned for specific compute workloads independently.
- **Negative**: Introduces network latency between the orchestrator and the execution engine.
- **Negative**: Requires a formal integration contract (Execution SDK) to map between the domains.
