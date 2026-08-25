import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { assertConsumesResolved } from "@spec-hub/codex-gate";
import { parseAgentSpecMarkdown } from "@spec-hub/shared-schemas";
import { enrichStructuralGraph } from "./enrich.js";
import { defaultFixturesDir } from "./paths.js";
import { graphPath, graphQuery } from "./query.js";
import { syncBookstackCorpus } from "./sync.js";

const SPEC_BODY = `
# Specification: Test Spec

## 1. Mission & Guardrails
* **Goal:** Enough text for mission clarity in tests.
* **Allowed Scope:**
  * \`src/foo/\`
* **Protected Scope:**
  * \`src/bar/\`
* **Non-Goals:**
  * No unrelated work.

## 2. Existing Utilities
* none

## 3. Data Contracts
\`\`\`typescript
export interface X { id: string }
\`\`\`

## 4. Acceptance Criteria
* **Scenario 1: Ok**
* **Given** a
* **When** b
* **Then** c

## 5. Verification & Test Guardrails
* \`pnpm lint\`
* \`pnpm test\`
* Minimum coverage requirement: 80%
`.trim();

function specMarkdown(fm: string): string {
  return `---\n${fm}\n---\n\n${SPEC_BODY}\n`;
}

describe("consume integrity", () => {
  it("rejects Ready-For-Agent orphan consumes", () => {
    const doc = parseAgentSpecMarkdown(
      specMarkdown(`
task_id: "TSK-NEG-001"
title: "Negative ready orphan consume"
repo: "billing-service"
shelf: "Backend-Core"
book: "Billing"
tags: ["repo:billing-service", "domain:checkout"]
status: "Ready-For-Agent"
complexity: "Standard"
owner: "Lead Engineer"
publishes: []
consumes: ["event:Missing@v1"]
impacts: []
depends_on: []
`.trim()),
    );
    const gate = assertConsumesResolved(doc.frontmatter, {
      publishes: new Set(),
    });
    assert.equal(gate.ok, false);
    assert.ok(gate.findings.some((f) => f.code === "ORPHAN_CONSUME" && f.severity === "error"));
  });

  it("warns Draft orphan consumes", () => {
    const doc = parseAgentSpecMarkdown(
      specMarkdown(`
task_id: "TSK-DRAFT-001"
title: "Draft orphan consume allowed"
repo: "billing-service"
shelf: "Backend-Core"
book: "Billing"
tags: ["repo:billing-service", "domain:checkout"]
status: "Draft"
complexity: "Standard"
owner: "Lead Engineer"
publishes: []
consumes: ["event:Missing@v1"]
impacts: []
depends_on: []
`.trim()),
    );
    const gate = assertConsumesResolved(doc.frontmatter, {
      publishes: new Set(),
    });
    assert.equal(gate.ok, true);
    assert.ok(gate.findings.some((f) => f.code === "ORPHAN_CONSUME" && f.severity === "warning"));
  });

  it("allows external: consumes without publisher", () => {
    const doc = parseAgentSpecMarkdown(
      specMarkdown(`
task_id: "TSK-EXT-001"
title: "External consume allowed"
repo: "billing-service"
shelf: "Backend-Core"
book: "Billing"
tags: ["repo:billing-service", "domain:checkout"]
status: "Ready-For-Agent"
complexity: "Standard"
owner: "Lead Engineer"
publishes: []
consumes: ["external:stripe.invoice.paid"]
impacts: []
depends_on: []
`.trim()),
    );
    const gate = assertConsumesResolved(doc.frontmatter, {
      publishes: new Set(),
    });
    assert.equal(gate.ok, true);
  });
});

describe("Orders→Billing fixtures smoke", () => {
  it("syncs fixtures, rejects orphan-ready, paths Orders to Billing", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "bs-graph-"));
    const corpusDir = path.join(tmp, "corpus");
    const graphOutDir = path.join(tmp, "graphify-out");

    const sync = await syncBookstackCorpus({
      source: "fixtures",
      fixturesDir: defaultFixturesDir(),
      corpusDir,
    });

    assert.ok(sync.pageCount >= 3);
    assert.ok(sync.publishes.includes("event:OrderCancelled@v1"));
    assert.ok(
      sync.rejected.some((r) => r.taskId === "TSK-BILL-ORPHAN-READY"),
      "Ready-For-Agent orphan must be rejected",
    );
    const draftGate = sync.gateFindings.find((g) => g.taskId === "TSK-BILL-DRAFT-01");
    assert.ok(draftGate?.ok);
    assert.ok(draftGate?.findings.some((f) => f.severity === "warning"));

    const billReady = sync.gateFindings.find((g) => g.taskId === "TSK-BILL-011");
    assert.ok(billReady?.ok, "Billing consumer resolves when Orders publishes");

    const graph = await enrichStructuralGraph({ corpusDir, graphOutDir });
    assert.ok(graph.edges.some((e) => e.type === "PUBLISHES"));
    assert.ok(graph.edges.some((e) => e.type === "CONSUMES"));

    const pathResult = await graphPath({
      from: "TSK-ORD-042",
      to: "TSK-BILL-011",
      graphPath: path.join(graphOutDir, "graph.json"),
      corpusDir,
    });
    assert.equal(pathResult.found, true);

    const toContract = await graphPath({
      from: "TSK-ORD-042",
      to: "event:OrderCancelled@v1",
      graphPath: path.join(graphOutDir, "graph.json"),
      corpusDir,
    });
    const toBilling = await graphPath({
      from: "event:OrderCancelled@v1",
      to: "TSK-BILL-011",
      graphPath: path.join(graphOutDir, "graph.json"),
      corpusDir,
    });
    assert.equal(toContract.found, true, "Orders should reach OrderCancelled contract");
    assert.equal(toBilling.found, true, "OrderCancelled should reach Billing");
    assert.ok(
      toContract.path.some((p) => p.id.includes("OrderCancelled")) &&
      toBilling.path.some((p) => p.id.includes("TSK-BILL-011")),
      "path should include Orders → contract → Billing",
    );

    const q = await graphQuery({
      query: "OrderCancelled",
      graphPath: path.join(graphOutDir, "graph.json"),
      corpusDir,
    });
    assert.ok(q.hits.length > 0);
    assert.ok(q.hits.every((h) => h.body === undefined), "frontmatter-first by default");
  });
});
