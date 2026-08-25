import type { SpecFormData } from "@agentdoc/shared-schemas";

export type GateFinding = {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  field?: keyof SpecFormData | string;
};

export type GateResult = {
  ok: boolean;
  findings: GateFinding[];
};

/**
 * Deterministic pre-checks before Codex refinement (Milestone 2).
 * Overlap / completeness heuristics live here; LLM audit plugs in later.
 */
export function runLocalQualityGate(data: SpecFormData): GateResult {
  const findings: GateFinding[] = [];

  const allowed = new Set(data.allowedPaths);
  const overlap = data.protectedPaths.filter((p) => allowed.has(p));
  if (overlap.length > 0) {
    findings.push({
      code: "PATH_OVERLAP",
      severity: "error",
      message: `allowedPaths overlaps protectedPaths: ${overlap.join(", ")}`,
      field: "protectedPaths",
    });
  }

  if (!data.dataContracts?.trim()) {
    findings.push({
      code: "MISSING_CONTRACTS",
      severity: "warning",
      message: "dataContracts is empty; agents may invent interfaces.",
      field: "dataContracts",
    });
  }

  return {
    ok: findings.every((f) => f.severity !== "error"),
    findings,
  };
}

/**
 * Placeholder for Codex CLI multi-turn audit (SPEC §3.3).
 * Not implemented in the scaffold — returns local gate only.
 */
export async function analyzeSpecification(
  data: SpecFormData,
): Promise<GateResult> {
  return runLocalQualityGate(data);
}
