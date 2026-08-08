# ADR-006: Replay by Cloning WorkflowRun

## Status
Accepted

## Context
When a workflow fails midway (e.g., node C out of A -> B -> C -> D), operators need the ability to "replay" the workflow from the point of failure without re-executing successful upstream nodes (A and B). Modifying the state of the *existing* failed `WorkflowRun` in-place complicates auditability, history tracking, and debugging.

## Decision
We treat `WorkflowRun` and `TaskRun` records as immutable once they reach a terminal state. A replay creates a completely *new* `WorkflowRun` entity. The new run clones the state and outputs of the successful tasks from the original run, and only dispatches the failed and pending tasks.

## Consequences
- **Positive**: Preserves perfect historical lineage. We can trace every attempt of a workflow execution.
- **Positive**: Avoids race conditions associated with mutating historical records.
- **Negative**: Increases the storage footprint in the database since replaying creates duplicate successful task records.
