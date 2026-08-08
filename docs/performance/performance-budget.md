# Platform Performance Budget & SLOs

This document establishes the Service Level Objectives (SLOs) and internal performance budgets for the platform. Benchmarks must be validated against these targets.

| Metric | SLO Target | Warning Threshold | Description |
|--------|------------|-------------------|-------------|
| **API P50 Latency** | `< 25 ms` | `> 50 ms` | Median time for DTP API to accept payload and enqueue. |
| **API P95 Latency** | `< 100 ms` | `> 150 ms` | Tail latency for enqueueing jobs. |
| **Dispatch Latency** | `< 50 ms` | `> 100 ms` | Time for WOE to successfully dispatch task via SDK. |
| **Queue Wait Time** | `< 500 ms` | `> 1000 ms` | Time a task spends in Redis before a worker claims it. |
| **Workflow End-to-End** | `< 2 s` | `> 5 s` | Total round-trip time from WOE -> DTP -> Worker -> Webhook -> WOE. |
| **API Error Rate** | `< 0.1%` | `> 1%` | Percentage of HTTP 5xx responses under load. |
| **Scheduler Recovery Time** | `< 60 s` | `> 120 s` | Maximum time a zombie task remains orphaned before retry logic fires. |

## Capacity Targets
At peak load (e.g. Black Friday), the platform is expected to sustain:
- **1,000 requests/sec** to the API
- **500 tasks/sec** throughput processed by workers
- **< 200MB Memory footprint** per worker instance

If a PR causes these targets to be violated on the baseline benchmark, the PR is rejected until optimized.
