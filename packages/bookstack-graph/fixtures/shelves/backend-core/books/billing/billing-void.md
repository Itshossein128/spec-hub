---
task_id: "TSK-BILL-011"
title: "Billing: void invoice on OrderCancelled"
repo: "billing-service"
shelf: "Backend-Core"
book: "Billing"
chapter: "Invoice-Void"
tags: ["repo:billing-service", "domain:checkout"]
status: "Ready-For-Agent"
complexity: "Complex"
owner: "Lead Engineer"
publishes: []
consumes:
  - "event:OrderCancelled@v1"
impacts:
  - "repo:billing-service#invoice-void"
depends_on:
  - "TSK-ORD-042"
---

# Specification: Billing: void invoice on OrderCancelled

## 1. Mission & Guardrails
* **Goal:** Void open invoices when OrderCancelled is consumed.
* **Allowed Scope:**
  * `src/modules/billing/void/`
* **Protected Scope:**
  * `src/core/payments/gateway.ts`
* **Non-Goals:**
  * Do not cancel orders from billing.

## 2. Existing Utilities
* `src/shared/events/consumer.ts`

## 3. Data Contracts
```typescript
export interface OrderCancelledV1 {
  orderId: string;
  cancelledAt: string;
  reason: string;
}
```

## 4. Acceptance Criteria
* **Scenario 1: Void on cancel**
* **Given** an open invoice for order O1
* **When** event:OrderCancelled@v1 arrives for O1
* **Then** invoice is voided idempotently.

## 5. Verification & Test Guardrails
* `pnpm lint`
* `pnpm test:unit src/modules/billing/void/`
* Minimum coverage requirement: 85%
