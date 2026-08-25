# AgentDoc Bridge: Multi-Agent Software Documentation & Context Hub

> **Architecture, Specification & Implementation Blueprint**  
> *Target Stack: Next.js (App Router) / TypeScript / MCP Server / BookStack API / Codex CLI*

---

## 1. Executive Summary & Vision

This project addresses a critical failure mode in software engineering multi-agent systems: **context ambiguity and untyped documentation**. Developer worker agents often fail or hallucinate when documentation in wiki systems (like BookStack) is unstructured, lacks explicit blast-radius boundaries, or contains open-ended natural language descriptions.

**AgentDoc Bridge** is an end-to-end platform comprising:

1. **Developer Portal (Web App):** A structured form enforcing granular inputs (Shelf, Book, Tags, User Story, Blast Radius, Contracts, and Gherkin-style Acceptance Criteria).
2. **Analysis & Refinement Engine (Codex / LLM Gateway):** An automated gate that analyzes the raw specification, detects ambiguities, validates invariants, and refines the draft into an "Agent-Ready Specification".
3. **MCP BookStack Server:** A standard Model Context Protocol server exposing BookStack pages, shelves, and books as structured Markdown resources and tools for multi-agent workflows.

---

## 2. System Architecture & Topology

```text
+-----------------------------------------------------------------------------------+
|                                DEVELOPER WORKSPACE                                |
|                                                                                   |
|  [ Developer ] ---> [ Web App (Next.js Form) ]                                    |
|                              |                                                    |
|                              v (Draft Spec Payload)                               |
|                     [ Validation & Codex CLI ] <----+ (Self-Correction Loop)      |
|                              |                      |                             |
|                              v (Agent-Ready Spec)   | (Quality Rejection)         |
|                     [ Quality Gate (JSON Schema) ]--+                             |
|                              |                                                    |
|                              v (Approved Payload)                                 |
|                     [ MCP Client / Orchestrator ]                                 |
|                              | (JSON-RPC over stdio / SSE)                        |
|                              v                                                    |
|               +-------------------------------+                                   |
|               |    BookStack MCP Server       |                                   |
|               |  - Resource: bookstack://*    |                                   |
|               |  - Tool: create_spec_page     |                                   |
|               |  - Tool: update_spec_page     |                                   |
|               +-------------------------------+                                   |
|                              | (REST API + Token Auth)                            |
|                              v                                                    |
|                     [ BookStack Instance ]                                        |
|                     (Knowledge Base / Wiki)                                       |
+-----------------------------------------------------------------------------------+
                               |
                               | (Reads Agent-Ready Specs via MCP)
                               v
+-----------------------------------------------------------------------------------+
|                           AUTONOMOUS DEV AGENTS                                   |
|                                                                                   |
|  [ Planner Agent ]  --->  [ Architect Agent ]  --->  [ Coder Agent / Verifier ]   |
|   (Task Decomp)            (Contract / Diff)          (TDD & Implementation)      |
+-----------------------------------------------------------------------------------+
```

---

## 3. Core Components Breakdown

### 3.1. Web App Input Schema (Developer Form)

The frontend enforces strict data typing using Zod before any agent pipeline is triggered:

```typescript
// schemas/specFormSchema.ts
import { z } from 'zod';

export const SpecFormSchema = z.object({
  shelfId: z.number().int().positive(),
  bookId: z.number().int().positive(),
  chapterId: z.number().int().optional(),
  title: z.string().min(5).max(120),
  tags: z.array(z.string()).min(1),
  taskType: z.enum(['FEATURE', 'BUGFIX', 'REFACTOR', 'MIGRATION']),
  complexity: z.enum(['TRIVIAL', 'STANDARD', 'COMPLEX', 'ARCHITECTURAL']),
  owner: z.string().default('Lead Engineer'),

  // High-value Agent Guardrails
  mission: z.string().min(20, 'Goal description must be clear and concise'),
  allowedPaths: z.array(z.string()).min(1, 'At least one target path required'),
  protectedPaths: z.array(z.string()).default([]),
  nonGoals: z.array(z.string()).min(1, 'Define explicit out-of-scope boundaries'),

  // Contracts & Scenarios
  existingDependencies: z.array(z.string()).default([]),
  dataContracts: z.string().optional(), // Typescript Interfaces or JSON Schema
  acceptanceCriteria: z.array(
    z.object({
      scenario: z.string(),
      given: z.string(),
      when: z.string(),
      then: z.string(),
    })
  ).min(1, 'At least one Gherkin scenario is required'),

  verificationCommands: z.object({
    lint: z.string().default('pnpm lint'),
    test: z.string().default('pnpm test'),
    coverageThreshold: z.number().min(0).max(100).default(80),
  }),
});

export type SpecFormData = z.infer<typeof SpecFormSchema>;
```

---

### 3.2. BookStack MCP Server Primitives

The MCP Server implements the official specification and exposes the following tools & resources:

#### MCP Tools

1. `bookstack_create_page`
   - **Arguments:** `book_id`, `chapter_id?`, `title`, `markdown_content`, `tags`
   - **Behavior:** Transforms frontmatter + body into BookStack markdown page via API.

2. `bookstack_search_context`
   - **Arguments:** `query`, `shelf_id?`, `book_id?`, `tags?`
   - **Behavior:** Queries BookStack with scoped filtering to retrieve existing architecture and utilities.

3. `bookstack_validate_spec`
   - **Arguments:** `page_id`
   - **Behavior:** Checks whether the page complies with the Agent-Ready standard structure.

#### MCP Resources

- `bookstack://shelves/{shelf_id}/summary` → Summarized architecture overview of a shelf.
- `bookstack://books/{book_id}/contracts` → Aggregated DTOs and API interfaces.
- `bookstack://specs/{task_id}` → Raw markdown of an agent-ready specification.

---

### 3.3. Refinement Pipeline (Codex CLI Integration)

When a developer submits a form, the backend executes the following multi-turn audit:

1. **Step 1: Completeness & Ambiguity Scan**
   - Codex analyzes whether `dataContracts` matches the `acceptanceCriteria`.
   - Checks if `allowedPaths` overlaps with `protectedPaths`.

2. **Step 2: Dependency Verification**
   - Queries BookStack (via MCP) to check if any specified utility in `existingDependencies` already exists in another chapter.

3. **Step 3: Markdown Assembly**
   - Builds the finalized Markdown containing standard YAML Frontmatter.

4. **Step 4: BookStack Ingestion**
   - Posts to BookStack using the MCP tool.

---

## 4. Agent-Ready Document Format Standard (Markdown Spec)

Example of an agent-ready specification page:

````markdown
---
task_id: "TSK-2026-08"
title: "Implement Idempotent Event Consumer"
shelf: "Backend-Core"
book: "Event-Bus"
chapter: "Consumers"
tags: ["kafka", "idempotency", "redis", "pnpm"]
status: "Ready-For-Agent"
complexity: "Complex"
owner: "Lead Engineer"
---

# Specification: [Task Name]

## 1. Mission & Guardrails
* **Goal:** Implement an idempotent event processor for Kafka webhook ingestion.
* **Allowed Scope:**
  * `src/modules/events/consumers/`
  * `src/database/migrations/`
* **Protected Scope (DO NOT TOUCH):**
  * `src/core/auth/`
  * `src/config/env.ts`
* **Non-Goals:**
  * Do not introduce new queue engines (e.g. RabbitMQ).
  * Do not modify the existing schema for user entities.

## 2. Existing Utilities & Context
* `src/shared/redis/lock.service.ts` -> Use `acquireLock(key, ttl)` for distributed locking.
* `src/shared/logger/index.ts` -> Use structured logger `appLogger.child({ module: 'event' })`.

## 3. Data Contracts
```typescript
export interface IngestedEventDTO {
  id: string;
  topic: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

export interface ConsumerResultDTO {
  success: boolean;
  ackToken: string;
  retryable: boolean;
}
```

## 4. Acceptance Criteria (Gherkin)

* **Scenario 1: Fresh Event Processing**
* **Given** an unhandled event with ID `evt_101`
* **When** consumer receives the payload
* **Then** persist record to DB and return `ackToken` with HTTP 200 equivalent.

* **Scenario 2: Duplicate Event Replay**
* **Given** an event with ID `evt_101` already present in Redis
* **When** consumer receives duplicate payload
* **Then** skip business execution and log warning without failing.

## 5. Verification & Test Guardrails

* `pnpm lint`
* `pnpm test:unit src/modules/events/consumers/`
* Minimum coverage requirement: 85%
````

---

## 5. Project Implementation Roadmap

### Milestone 1: MCP Server Foundation (BookStack Bridge)

- [ ] Initialize TypeScript MCP Server repository with `@modelcontextprotocol/sdk`.
- [ ] Implement BookStack API wrapper (Axios / Fetch with token authentication).
- [ ] Expose `bookstack_create_page`, `bookstack_update_page`, and `bookstack_search_context`.
- [ ] Add unit & integration tests with mock BookStack HTTP fixtures.

### Milestone 2: Codex Analysis & Quality Gate CLI

- [ ] Create system prompts and prompt templates for ambiguity analysis.
- [ ] Implement local CLI bridge wrapping Codex to audit user-submitted specifications.
- [ ] Define JSON validation schemas for AST checking of specification files.

### Milestone 3: Web App Management Portal (Next.js)

- [ ] Setup Next.js app router with Tailwind CSS & UI components.
- [ ] Build dynamic form with reactive Gherkin scenario builders and path selectors.
- [ ] Integrate real-time Codex feedback review pane (Diff viewer + Human approval).
- [ ] Wire up MCP Client transport to push approved specifications directly to BookStack.

### Milestone 4: Multi-Agent Ingestion & Execution Benchmark

- [ ] Connect worker agents (Planner, Coder, Verifier) to consume specs via BookStack MCP.
- [ ] Benchmark execution pass rates on standard microservice tasks.
