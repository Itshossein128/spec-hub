---
task_id: "TSK-ORD-042"
title: "Orders: cancel status transition"
repo: "orders-service"
shelf: "Backend-Core"
book: "Orders"
chapter: "Cancel-Flow"
tags: ["repo:orders-service", "domain:checkout"]
status: "Ready-For-Agent"
complexity: "Complex"
owner: "Lead Engineer"
publishes:
  - "event:OrderCancelled@v1"
consumes: []
impacts:
  - "repo:billing-service#invoice-void"
depends_on: []
---

# Specification: Orders: cancel status transition

## 1. Mission & Guardrails
* **Goal:** Emit OrderCancelled when an order is cancelled so downstream services can react.
* **Allowed Scope:**
  * `src/modules/orders/cancel/`
* **Protected Scope:**
  * `src/core/auth/`
* **Non-Goals:**
  * Do not implement billing void logic here.

## 2. Existing Utilities
* `src/shared/events/publisher.ts`

## 3. Data Contracts
```typescript
export interface OrderCancelledV1 {
  orderId: string;
  cancelledAt: string;
  reason: string;
}
```

## 4. Acceptance Criteria
* **Scenario 1: Cancel emits event**
* **Given** an open order
* **When** cancel is requested
* **Then** publish event:OrderCancelled@v1 and persist cancelled status.

## 5. Verification & Test Guardrails
* `pnpm lint`
* `pnpm test:unit src/modules/orders/cancel/`
* Minimum coverage requirement: 85%
