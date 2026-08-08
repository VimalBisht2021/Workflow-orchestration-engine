# Performance Report [ID]: [Title]

**Date**: YYYY-MM-DD
**Author**: 

---

## 1. Test Environment (Frozen)
- **CPU**: [e.g., Apple M2 Max, 12 Core]
- **RAM**: [e.g., 32GB]
- **OS / Docker**: [e.g., macOS Sonoma / Docker Desktop 4.30 - 8 CPU / 8GB RAM]
- **Node.js**: [v18.x]
- **Redis / PostgreSQL**: [Redis 7.2 / PG 15]
- **Versions**:
  - WOE: [SHA]
  - DTP: [SHA]

## 2. Load Profile
- **Scenario**: [Smoke | Small | Medium | Large | Topology]
- **Script**: `[name].js`
- **Volume**: [X] workflows, [Y] total tasks
- **Payload Size**: [Tiny | Small | Medium | Large]
- **Component Scaling**: Workers: [N], Redis: [N], Postgres: [N], Scheduler: [N], API: [N]

## 3. Results (Metrics vs SLO)

| Metric | Target | Actual | Status (Pass/Fail) |
|--------|--------|--------|--------------------|
| API Request Latency (P95) | < 100 ms | | |
| API Requests / Sec | > 1000/s | | |
| WOE Dispatch Latency | < 50 ms | | |
| Queue Wait Time (P95) | < 500 ms | | |
| Task Execution Latency | -- | | |
| End-to-End Latency | < 2 s | | |
| Error Rate | < 0.1% | | |
| Scheduler Recovery Time | < 60 s | | |

## 4. Queue Dynamics & Pipeline Stages
- **Queue Ingress Rate**: [X] jobs/sec
- **Queue Egress Rate**: [X] jobs/sec
- **Max Queue Depth**: [X] jobs
- **Pipeline Breakdown**: WOE -> API ([X]ms) -> Queue ([X]ms) -> Worker ([X]ms) -> Webhook ([X]ms)

## 5. Resource Utilization
- **Worker CPU / Memory**: [X]% / [Y]MB
- **Redis Commands/sec & Memory**: [X] cmd/s, [Y]MB
- **Postgres Queries/sec**: [X] q/s

## 6. Historical Comparison
| Metric | Previous (Report [ID]) | Current | Change |
|--------|-------------------------|---------|--------|
| Dispatch P95 | | | |
| Throughput | | | |
| Queue Wait | | | |

## 7. Failures & Immediate Bottlenecks
- Details on bottlenecks, errors, and resilience metrics (e.g., duplicate executions).

## 8. Remaining Bottlenecks (Next Limiting Factor)
Current Bottleneck Ranking:
1. [e.g., PostgreSQL writes]
2. [e.g., Worker CPU]
3. [e.g., Network callbacks to WOE]

## 9. Recommendations
- Next optimization step to test based on the #1 remaining bottleneck.
