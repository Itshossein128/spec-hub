---
task_id: "TSK-BILL-DRAFT-01"
title: "Billing draft consumer of missing event"
repo: "billing-service"
shelf: "Backend-Core"
book: "Billing"
chapter: "Drafts"
tags: ["repo:billing-service", "domain:checkout", "draft"]
status: "Draft"
complexity: "Standard"
owner: "Lead Engineer"
publishes: []
consumes:
  - "event:DoesNotExistYet@v1"
impacts: []
depends_on: []
---

# Specification: Billing draft consumer of missing event

## 1. Mission & Guardrails
* **Goal:** Sketch consumer-driven consume before publisher exists.
* **Allowed Scope:**
  * `src/modules/billing/draft/`
* **Protected Scope:**
  * `src/core/auth/`
* **Non-Goals:**
  * Do not promote to Ready-For-Agent until publisher exists.

## 2. Existing Utilities
* _(none)_

## 3. Data Contracts
```typescript
export interface PlaceholderEvent {
  id: string;
}
```

## 4. Acceptance Criteria
* **Scenario 1: Draft allowed**
* **Given** a draft spec with orphan consumes
* **When** integrity gate runs
* **Then** only a warning is emitted.

## 5. Verification & Test Guardrails
* `pnpm lint`
* `pnpm test`
* Minimum coverage requirement: 80%
