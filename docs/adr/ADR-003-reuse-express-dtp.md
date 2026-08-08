# ADR-003: Reusing Express DTP vs Building BullMQ

## Status
Accepted

## Context
During the initial design of the Execution Plane, a proposal was made to build a brand-new DTP using NestJS and BullMQ to simplify the architecture and reduce maintenance overhead. However, the existing Express-based DTP already possessed battle-tested features that BullMQ alone does not provide out of the box (Optimistic Concurrency Control, distributed worker crash recovery, scheduler leader election).

## Decision
We will reuse the existing Express DTP and integrate it into the platform architecture via an `integration/` module, rather than throwing it away and building a new BullMQ execution cluster.

## Consequences
- **Positive**: Immediate access to mature operational features (crash recovery, OCC, priority queues).
- **Positive**: Eliminates months of rewrite effort for distributed systems problems that were already solved.
- **Negative**: The platform retains a heterogeneous stack (NestJS for WOE, Express for DTP).
