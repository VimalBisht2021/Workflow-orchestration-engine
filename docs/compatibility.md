# Version Compatibility Matrix

As the Workflow Platform scales, components may be deployed at different times. It is critical to ensure that the Workflow Orchestration Engine (WOE) is compatible with the version of the Distributed Task Platform (DTP) it targets.

The `execution-sdk` is the arbiter of this compatibility.

## Current Supported Combinations

| Component | Target Version | Supported | Notes |
| :--- | :--- | :--- | :--- |
| **WOE** | `v1` | ✅ | Control Plane |
| **Execution SDK** | `v1` | ✅ | Anti-Corruption Layer |
| **Execution Contract** | `v1` | ✅ | Shared Typings |
| **DTP API** | `v1` | ✅ | Execution Plane |
| **DTP Worker** | `v1` | ✅ | |
| **DTP Scheduler** | `v1` | ✅ | |

## Compatibility Rules

1. **Forward Compatibility**: `DTP API` will always support the previous version's `CreateJobDto` payload for at least one major version to allow WOE instances to roll out slowly.
2. **Upgrade Order**: Always deploy `DTP` (Execution Plane) before `WOE` (Control Plane) to ensure the execution infrastructure is ready to accept the latest contract capabilities.
3. **Webhook Schema**: WOE defines `specVersion` (currently `"1.0"`) on incoming webhooks. DTP is responsible for sending webhooks that comply with this schema version.

## Deprecation Policy
Features deprecated in the `execution-contract` will emit console warnings in `WOE` for 30 days prior to removal. DTP API will return a `400 Bad Request` if an unsupported schema is submitted.
