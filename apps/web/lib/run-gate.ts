import {
  analyzeSpecification,
  assertConsumesResolved,
  assertHierarchyPlacement,
  runLocalQualityGate,
  type GateFinding,
  type GateResult,
  type PublishesCatalog,
} from "@spec-hub/codex-gate";
import type { SpecFormData } from "@spec-hub/shared-schemas";
import { monorepoRoot } from "./env";
import { mapFormToMarkdown, type SpecStatus } from "./map-form-to-markdown";
import { gatherSpecReviewContext } from "./review-context";

export function mergeGateResults(...results: GateResult[]): GateResult {
  const findings = results.flatMap((r) => r.findings);
  return {
    ok: findings.every((f) => f.severity !== "error"),
    findings,
  };
}

export type EvaluateSpecGateOptions = {
  /** Run Codex CLI audit (validate + Ready-For-Agent). */
  runCodexAudit?: boolean;
  /** Known publishes for consume integrity. */
  catalog: PublishesCatalog;
  /** Soften Codex CLI missing/timeout to warning (validate). */
  softCodexFailure?: boolean;
};

/**
 * Deterministic gates always run.
 * Codex CLI audit runs when `runCodexAudit` is true (SPEC §3.3).
 */
export async function evaluateSpecGate(
  data: SpecFormData,
  status: SpecStatus,
  options: EvaluateSpecGateOptions,
): Promise<GateResult> {
  const local = runLocalQualityGate(data);
  const hierarchy = assertHierarchyPlacement(data, { statusOverride: status });
  const consumes = assertConsumesResolved(data, options.catalog, {
    statusOverride: status,
  });

  const merged = mergeGateResults(local, hierarchy, consumes);

  if (!options.runCodexAudit) {
    return merged;
  }

  // Fail-fast: skip expensive Codex when local errors already block Ready.
  if (!merged.ok && status === "Ready-For-Agent") {
    return merged;
  }

  const markdown = mapFormToMarkdown(data, status);
  const relatedContext = await gatherSpecReviewContext(data, {
    publishesCatalog: [...options.catalog.publishes],
  });

  const codex = await analyzeSpecification({
    markdown,
    relatedContext,
    status,
    cwd: monorepoRoot(),
    unavailableSeverity: options.softCodexFailure ? "warning" : "error",
  });

  return mergeGateResults(merged, codex);
}

export type { GateFinding, GateResult, PublishesCatalog };
