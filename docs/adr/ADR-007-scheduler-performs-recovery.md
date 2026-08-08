# ADR-007: Scheduler Performs Recovery

## Status
Accepted

## Context
Workers can crash abruptly due to OOM errors, SIGKILL, or hardware failures. If a worker dies while executing a job, the job is stuck in the `RUNNING` state indefinitely (a stranded job).
We need a mechanism to detect and requeue these jobs.

## Decision
We centralize worker crash detection and job recovery in the `Scheduler` service. The scheduler continuously polls for workers that haven't updated their heartbeat within the timeout threshold. It marks those workers as `DEAD` and transitions their `RUNNING` jobs back to `QUEUED`.

## Consequences
- **Positive**: Keeps worker implementations extremely simple. Workers do not need to self-police or implement gossip protocols.
- **Positive**: Centralizes the logic for "time-to-live" and recovery in a service that is designed to manage queues.
- **Negative**: The scheduler becomes a critical single point of failure (mitigated via Redis lock-based leader election).
