# Chaos Fault Matrix

This matrix tracks all formalized chaos experiments, the expected architectural response, and the observed recovery time required to meet SLOs.

| Fault                 | Expected Behaviour | Recovery SLO | Status | Verified By |
|-----------------------|--------------------|--------------|--------|-------------|
| **Worker SIGKILL**    | Scheduler detects zombie via heartbeat timeout and requeues job without duplicates. | < 60 sec | PASS | Report 002 |
| **Scheduler Split-Brain** | OCC rejects stale recovery writes; only one scheduler successfully recovers zombie tasks. | Immediate | PASS | Report 001 |
| **Webhook Latency**   | DTP worker respects timeout, fails task, and triggers standard retry exponential backoff. | < 5 sec | PASS | Report 003 |
| **Duplicate Webhook** | WOE idempotency keys reject the second payload; workflow state remains deterministic. | Immediate | PASS | Report 004 |
| **Redis Restart**     | Queue operations fail fast; DTP API returns 503; Workers enter exponential backoff until Redis heals. | < 30 sec | PASS | Report 005 |
