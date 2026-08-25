---
task_id: "TSK-2026-08"
title: "Implement Idempotent Event Consumer"
repo: "orders-service"
shelf: "Backend-Core"
book: "Event-Bus"
chapter: "Consumers"
tags: ["repo:orders-service", "domain:checkout", "kafka", "idempotency"]
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

# Specification: [نام تسک]

## ۱. اهداف و مرزهای تغییر (Mission & Guardrails)
* **Goal:** [شرح مختصر هدف تجاری و فنی]
* **Allowed Scope (مسیرهای مجاز):**
  * `src/modules/events/consumers/`
  * `src/database/migrations/`
* **Protected Scope (مسیرهای ممنوعه):**
  * `src/core/auth/`
  * `src/config/env.ts`
* **Non-Goals (نبایدها):**
  * دستکاری در ساختار دیتابیس کاربران مجاز نیست.

## ۲. توابع و کدهای اشتراکی (Existing Utilities)
* `src/shared/redis/lock.service.ts` -> متد `acquireLock(key, ttl)` برای قفل توزیع‌شده.
* `src/shared/logger/index.ts` -> استفاده از لاگر ساختاریافته `appLogger`.

## ۳. قراردادهای ورودی/خروجی (Data Contracts)
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

## ۴. معیارهای پذیرش (Acceptance Criteria)
* **Scenario 1: Fresh Event Processing**
* **Given** an unhandled event with ID `evt_101`
* **When** consumer receives the payload
* **Then** persist record to DB and return `ackToken` with HTTP 200 equivalent.

* **Scenario 2: Duplicate Event Replay**
* **Given** an event with ID `evt_101` already present in Redis
* **When** consumer receives duplicate payload
* **Then** skip business execution and log warning without failing.

## ۵. راستی‌آزمایی و تست (Verification & Test Guardrails)
* `pnpm lint`
* `pnpm test:unit src/modules/events/consumers/`
* Minimum coverage requirement: 85%

<!--
Relation model (for authors):
- tags = filters only (`repo:…`, `domain:…` required when Ready-For-Agent; free-form extras OK)
- publishes / consumes / impacts / depends_on = typed graph edges
- Publish-before-consume: Draft/In-Review orphan consumes → warning;
  Ready-For-Agent/Done orphan consumes → reject unless prefixed external:
-->
