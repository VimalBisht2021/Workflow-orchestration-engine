# Definition of Done (DoD)

This document formalizes our engineering standards. A feature is considered **complete** only if it satisfies all of the following criteria across the engineering, quality, operations, security, deployment, and documentation pillars.

## 1. Engineering
- [ ] Requirements satisfied
- [ ] Architecture document updated (if needed)
- [ ] ADR written (if architectural decision changed)
- [ ] Code reviewed
- [ ] No TODO/FIXME left without issue reference

## 2. Quality
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] System tests pass
- [ ] Contract compatibility passes (Forward and Backward)
- [ ] Coverage threshold maintained (Coverage does not regress)

## 3. Operations
- [ ] Metrics added
- [ ] Structured logging added
- [ ] Traces added (if distributed)
- [ ] Alerts reviewed (if applicable)
- [ ] Existing SLOs still satisfied (e.g. Dispatch latency <100ms, Webhook <500ms)

## 4. Security
- [ ] Dependency scan passes (Trivy/npm audit)
- [ ] Container scan passes (Trivy)
- [ ] Secrets scan passes

## 5. Deployment
- [ ] Docker image builds successfully
- [ ] SBOM generated (Syft)
- [ ] Image signed (Cosign)

## 6. Documentation
- [ ] API documentation updated
- [ ] Architecture documentation updated
- [ ] Operational documentation updated
