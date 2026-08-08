# ADR-005: Webhooks over Synchronous Callbacks

## Status
Accepted

## Context
When WOE dispatches a task to DTP, WOE needs to know when the task finishes (success or failure) to unblock the next nodes in the DAG. We could have WOE poll DTP continuously, or have DTP return a long-lived synchronous HTTP response.

## Decision
We utilize asynchronous Webhooks. DTP accepts the HTTP POST from WOE, enqueues the job, and immediately returns a `202 Accepted` response. When the job finishes asynchronously, DTP issues a reverse HTTP POST (Webhook) to WOE's callback URL.

## Consequences
- **Positive**: Complete decoupling of execution latency. WOE does not hold open HTTP connections waiting for 30-minute jobs to complete.
- **Positive**: WOE can safely restart or scale down; the webhooks will simply be received by whichever WOE instance is alive when the task finishes.
- **Negative**: Requires WOE to implement strict idempotency handling, as webhooks may be delivered "at least once".
