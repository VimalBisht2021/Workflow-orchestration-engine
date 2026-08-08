# Chaos Experiment [ID]: [Title]

**Date**: YYYY-MM-DD
**Author**: 

---

## 1. Experiment Definition
- **Purpose**: [Why are we running this experiment?]
- **Architectural Guarantee**: [What specific invariant or resilience mechanism is being validated?]
- **Failure Injection**: [How are we introducing the fault? e.g., Toxiproxy webhook latency of 10s]

## 2. Hypothesized Behavior
- **Expected Behaviour**: [How should the system handle the fault?]
- **Pass/Fail Criteria**: [Specific, measurable criteria. e.g., "Worker detects timeout, requeues task, no duplicate execution occurs."]

## 3. Results & Observations
- **Observed Behaviour**: [What actually happened?]
- **Recovery Time**: [Time taken for the system to self-heal]
- **Duplicate Executions**: [Count, should be 0]
- **Duplicate Webhooks**: [Count]
- **Data Loss**: [Yes/No]
- **Invariant Violations**: [Detail any broken rules]

## 4. Observability Validation
- **Metrics**: Did Grafana/Prometheus show the degradation? [Yes/No, Details]
- **Logs**: Were errors clearly logged with `correlationId`? [Yes/No, Details]
- **Trace**: Did the distributed trace capture the interruption? [Yes/No, Details]
- **Alerts**: Did PagerDuty/Slack fire? [Yes/No, Details]

## 5. Conclusion & Recommendations
- **Result**: [PASS / FAIL / PARTIAL]
- **Recommendations**: [Any code or infrastructure changes required?]
