# Risk Register

This document tracks known limitations, vulnerabilities, and unsupported features of the platform. These are architectural compromises that have been *deliberately accepted* and should not be relied upon by downstream consumers.

---

## 1. Cross-Region Deployment
- **Status**: Not Implemented
- **Reason**: The platform relies on a single-region PostgreSQL primary and a single-region Redis instance for OCC and queueing. Multi-region latency would heavily degrade dispatch performance. 

## 2. Effectively-Once Execution
- **Status**: Not Guaranteed
- **Mitigation**: The platform guarantees *at-least-once* execution. In the event of a worker crash *after* executing business logic but *before* acknowledging the queue, the task will be retried. Downstream handlers MUST be strictly idempotent.

## 3. Redis Cluster Failover
- **Status**: Future Work
- **Reason**: Currently relying on a single Redis node (or simple replica). True Redis Cluster sharding has not been configured in the `execution-sdk`, meaning a total Redis hardware failure requires manual promotion or DNS swapping.

## 4. Infinite Workflow Loops
- **Status**: Vulnerable
- **Mitigation**: While the DAG validator prevents direct cyclical dependencies during creation, dynamic looping structures (e.g., "retry this sub-workflow until X") have no enforced maximum depth, which could lead to DB bloat.
