# ADR-004: Optimistic Concurrency Control vs Pessimistic Locking

## Status
Accepted

## Context
When multiple workers or schedulers attempt to modify the state of a job simultaneously (e.g., transitioning from `QUEUED` to `RUNNING`, or attempting to recover a crashed job), we must prevent race conditions.
Pessimistic locking (e.g., `SELECT FOR UPDATE` or Redis Mutexes) guarantees safety but drastically reduces throughput by blocking concurrent reads and writes.

## Decision
We utilize Optimistic Concurrency Control (OCC) relying on a `version` integer on the `Job` entity. Every update increments the version and includes a `WHERE id = ? AND version = ?` clause. If zero rows are affected, it implies another process modified the job concurrently, and a `ConcurrencyError` is thrown.

## Consequences
- **Positive**: High throughput, as reads are never blocked and locks are not held over the network.
- **Positive**: Eliminates the risk of deadlocks.
- **Negative**: Requires application-level retry logic when a concurrency conflict occurs (e.g., the worker must refetch the latest state and retry).
