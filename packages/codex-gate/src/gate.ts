import type {
  AgentSpecFrontmatter,
  SpecFormData,
} from "@spec-hub/shared-schemas";
import {
  isExternalContract,
  normalizeContractId,
} from "@spec-hub/shared-schemas";

export type GateFinding = {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  field?: keyof SpecFormData | string;
  /** Which layer produced the finding. */
  source?: "local" | "codex";
};

export type GateResult = {
  ok: boolean;
  findings: GateFinding[];
};

export type PublishesCatalog = {
  /** Normalized contract IDs published somewhere in the corpus / BookStack. */
  publishes: Set<string>;
};

const STRICT_STATUSES = new Set(["Ready-For-Agent", "Done"]);

function relationFields(spec: AgentSpecFrontmatter | SpecFormData): {
  status?: string;
  complexity?: string;
  publishes: string[];
  consumes: string[];
  impacts: string[];
} {
  if ("task_id" in spec) {
    return {
      status: spec.status,
      complexity: spec.complexity,
      publishes: spec.publishes ?? [],
      consumes: spec.consumes ?? [],
      impacts: spec.impacts ?? [],
    };
  }
  return {
    complexity: spec.complexity,
    publishes: spec.publishes ?? [],
    consumes: spec.consumes ?? [],
    impacts: spec.impacts ?? [],
  };
}

/**
 * Publish-before-consume integrity (status-gated).
 * - Draft / In-Review: orphan consumes → warning
 * - Ready-For-Agent / Done: orphan consumes → error (unless external:)
 */
export function assertConsumesResolved(
  spec: AgentSpecFrontmatter | SpecFormData,
  catalog: PublishesCatalog,
  options?: { statusOverride?: string },
): GateResult {
  const fields = relationFields(spec);
  const status = options?.statusOverride ?? fields.status ?? "Draft";
  const findings: GateFinding[] = [];
  const strict = STRICT_STATUSES.has(status);

  for (const raw of fields.consumes) {
    const id = normalizeContractId(raw);
    if (!id) continue;
    if (isExternalContract(id)) continue;
    if (catalog.publishes.has(id)) continue;

    findings.push({
      code: "ORPHAN_CONSUME",
      severity: strict ? "error" : "warning",
      message: strict
        ? `consumes "${id}" has no matching publishes in catalog (status ${status})`
        : `consumes "${id}" is unresolved; allowed as warning while status is ${status}`,
      field: "consumes",
      source: "local",
    });
  }

  const complexity = fields.complexity;
  const needsBlast =
    complexity === "Complex" ||
    complexity === "Architectural" ||
    complexity === "COMPLEX" ||
    complexity === "ARCHITECTURAL";

  if (
    needsBlast &&
    fields.publishes.length === 0 &&
    fields.impacts.length === 0
  ) {
    findings.push({
      code: "MISSING_BLAST_EDGES",
      severity: "warning",
      message:
        "Complex/Architectural specs should declare publishes and/or impacts",
      field: "publishes",
    });
  }

  return {
    ok: findings.every((f) => f.severity !== "error"),
    findings,
  };
}

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
      source: "local",
    });
  }

  if (!data.dataContracts?.trim()) {
    findings.push({
      code: "MISSING_CONTRACTS",
      severity: "warning",
      message: "dataContracts is empty; agents may invent interfaces.",
      field: "dataContracts",
      source: "local",
    });
  }

  return {
    ok: findings.every((f) => f.severity !== "error"),
    findings,
  };
}

export type AnalyzeSpecificationInput = {
  markdown: string;
  relatedContext?: string;
  status: string;
  /** Soften CODEX_UNAVAILABLE to warning (validate) vs error (Ready publish). */
  unavailableSeverity?: "error" | "warning";
  /** Working directory for `codex exec -C`. */
  cwd?: string;
};

/**
 * Codex CLI multi-turn audit (SPEC §3.3 / Milestone 2).
 * Requires `codex` on PATH (or CODEX_BIN).
 */
export async function analyzeSpecification(
  input: AnalyzeSpecificationInput,
): Promise<GateResult> {
  const { runCodexSpecAudit } = await import("./codexBridge.js");
  const result = await runCodexSpecAudit(
    {
      markdown: input.markdown,
      relatedContext: input.relatedContext ?? "",
      status: input.status,
    },
    { cwd: input.cwd },
  );

  if (input.unavailableSeverity === "warning") {
    return {
      ok: true,
      findings: result.findings.map((f) =>
        f.code === "CODEX_UNAVAILABLE" || f.code === "CODEX_PARSE_ERROR"
          ? { ...f, severity: "warning" as const }
          : f,
      ),
    };
  }

  return result;
}
