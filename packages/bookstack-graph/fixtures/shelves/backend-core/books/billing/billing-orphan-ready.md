---
task_id: "TSK-BILL-ORPHAN-READY"
title: "Billing ready orphan consume should fail"
repo: "billing-service"
shelf: "Backend-Core"
book: "Billing"
chapter: "Negative"
tags: ["repo:billing-service", "domain:checkout"]
status: "Ready-For-Agent"
complexity: "Standard"
owner: "Lead Engineer"
publishes: []
consumes:
  - "event:NeverPublished@v1"
impacts: []
depends_on: []
---

# Specification: Billing ready orphan consume should fail

## 1. Mission & Guardrails
* **Goal:** Negative fixture — Ready-For-Agent orphan consume must be rejected.
* **Allowed Scope:**
  * `src/modules/billing/negative/`
* **Protected Scope:**
  * `src/core/auth/`
* **Non-Goals:**
  * Not a real feature.

## 2. Existing Utilities
* _(none)_

## 3. Data Contracts
```typescript
export interface NeverPublished {
  id: string;
}
```

## 4. Acceptance Criteria
* **Scenario 1: Reject ready orphan**
* **Given** Ready-For-Agent status with orphan consumes
* **When** integrity gate runs
* **Then** validation fails with ORPHAN_CONSUME error.

## 5. Verification & Test Guardrails
* `pnpm lint`
* `pnpm test`
* Minimum coverage requirement: 80%
