import {
  assertConsumesResolved,
  assertHierarchyPlacement,
  runLocalQualityGate,
  type GateFinding,
  type GateResult,
  type PublishesCatalog,
} from "@spec-hub/codex-gate";
import type { SpecFormData } from "@spec-hub/shared-schemas";
import type { SpecStatus } from "./map-form-to-markdown";

export function mergeGateResults(...results: GateResult[]): GateResult {
  const findings = results.flatMap((r) => r.findings);
  return {
    ok: findings.every((f) => f.severity !== "error"),
    findings,
  };
}

export function evaluateSpecGate(
  data: SpecFormData,
  status: SpecStatus,
  catalog: PublishesCatalog,
): GateResult {
  const local = runLocalQualityGate(data);
  const hierarchy = assertHierarchyPlacement(data, { statusOverride: status });
  const consumes = assertConsumesResolved(data, catalog, {
    statusOverride: status,
  });
  return mergeGateResults(local, hierarchy, consumes);
}

export type { GateFinding, GateResult, PublishesCatalog };
