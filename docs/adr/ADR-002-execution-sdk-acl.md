# ADR-002: Purpose of Execution SDK

## Status
Accepted

## Context
WOE needs to dispatch tasks to DTP. If WOE directly imports DTP's API interfaces (`CreateJobDto`), WOE becomes tightly coupled to DTP's internal data structures. If DTP changes its internal routing or queuing models, WOE must be refactored.

## Decision
We will introduce `execution-sdk` to serve as a strict Anti-Corruption Layer (ACL) between WOE and DTP. 
- WOE depends only on the SDK's `DispatchRequest` interface.
- The SDK performs the translation from `DispatchRequest` into DTP's `CreateJobDto`.

## Consequences
- **Positive**: WOE's domain model remains pure and isolated from DTP's infrastructure concerns (e.g., webhooks, API keys).
- **Positive**: DTP can iterate on its API independently. The SDK absorbs the breaking changes.
- **Negative**: Adds a layer of indirection and a separate package to maintain.
