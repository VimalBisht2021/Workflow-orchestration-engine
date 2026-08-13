# Workflow Orchestration Engine (v1.0.0)

A production-grade platform for building, executing, and monitoring complex distributed workflows. Features a visual designer, parallel execution, automatic retries, full event-sourced replay capabilities, and graceful workflow cancellation with fail-fast resource cleanup.

## Architecture

- **Dashboard (Next.js):** Visual Workflow Studio for designing DAGs and monitoring runs.
- **API (NestJS):** The Control Plane for validating workflows, managing history, and communicating with the execution cluster.
- **Worker (Mock DTP):** A mock Distributed Task Platform worker that simulates remote task execution.
- **PostgreSQL & Redis:** Persistent storage for workflows and high-speed queues/caching.

## 🚀 Quick Start (Under 5 Minutes)

We've made evaluating this project incredibly simple. No complex local setup required.

### 1. Clone the repository

```bash
git clone https://github.com/your-username/workflow-orchestration-engine.git
cd workflow-orchestration-engine
```

### 2. Configure Environment

```bash
cp .env.example .env
```

### 3. Start the Platform

```bash
docker compose up -d --build
```

_Note: The first build will take a few minutes as it downloads dependencies and compiles the Next.js and NestJS applications._

### 4. Open the Dashboard

Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Run the Demo Workflow

1. Click **Open Workflow Studio** from the landing page.
2. The Studio will automatically load a Demo ETL Pipeline.
3. Click **Publish** to register the workflow.
4. Navigate to **View Workflows** and trigger a run!

## Security

Currently, the connection between WOE and DTP is secured using a **single shared API key** via the `x-api-key` header (with the `DISPATCHER` role).

**Future Enhancements:**

- Implement per-identity API keys with fine-grained RBAC scopes.
