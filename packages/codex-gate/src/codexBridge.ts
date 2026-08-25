import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { GateFinding, GateResult } from "./gate.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** Dist is packages/codex-gate/dist → package root is parent. */
export const CODEX_GATE_ROOT = path.resolve(HERE, "..");

export const DEFAULT_FINDINGS_SCHEMA = path.join(
  CODEX_GATE_ROOT,
  "schemas/codex-findings.schema.json",
);
export const DEFAULT_SYSTEM_PROMPT = path.join(
  CODEX_GATE_ROOT,
  "prompts/system-prompt.md",
);

export type CodexBridgeOptions = {
  /** Absolute path to `codex` binary. Default: CODEX_BIN or `codex`. */
  bin?: string;
  /** Working directory for Codex. Default: process.cwd(). */
  cwd?: string;
  /** Model override (CODEX_MODEL). */
  model?: string;
  /** Timeout ms (CODEX_GATE_TIMEOUT_MS). Default 120_000. */
  timeoutMs?: number;
  schemaPath?: string;
  systemPromptPath?: string;
};

type CodexFindingsPayload = {
  ok?: boolean;
  summary?: string;
  findings?: Array<{
    code?: string;
    severity?: string;
    message?: string;
    field?: string;
  }>;
};

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function normalizeFindings(
  payload: CodexFindingsPayload,
): GateResult {
  const findings: GateFinding[] = [];
  for (const raw of payload.findings ?? []) {
    const severity =
      raw.severity === "error" ||
      raw.severity === "warning" ||
      raw.severity === "info"
        ? raw.severity
        : "warning";
    const code = (raw.code ?? "CODEX_FINDING").trim() || "CODEX_FINDING";
    const message = (raw.message ?? "").trim();
    if (!message) continue;
    findings.push({
      code,
      severity,
      message,
      field: raw.field,
      source: "codex",
    });
  }

  if (payload.summary?.trim() && findings.length === 0) {
    findings.push({
      code: "CODEX_SUMMARY",
      severity: "info",
      message: payload.summary.trim(),
      source: "codex",
    });
  }

  return {
    ok: findings.every((f) => f.severity !== "error"),
    findings,
  };
}

function tryParseJson(text: string): CodexFindingsPayload | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as CodexFindingsPayload;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as CodexFindingsPayload;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Run `codex exec` with the Spec-Hub system prompt + related context.
 * Returns structured GateFindings. Does not throw on soft failures —
 * returns CODEX_UNAVAILABLE / CODEX_PARSE_ERROR findings instead.
 */
export async function runCodexSpecAudit(
  input: {
    markdown: string;
    relatedContext: string;
    status: string;
  },
  options: CodexBridgeOptions = {},
): Promise<GateResult> {
  const bin = options.bin ?? process.env.CODEX_BIN ?? "codex";
  const cwd = options.cwd ?? process.cwd();
  const timeoutMs =
    options.timeoutMs ?? envNumber("CODEX_GATE_TIMEOUT_MS", 120_000);
  const model = options.model ?? process.env.CODEX_MODEL;
  const schemaPath = options.schemaPath ?? DEFAULT_FINDINGS_SCHEMA;
  const systemPromptPath =
    options.systemPromptPath ?? DEFAULT_SYSTEM_PROMPT;

  let systemPrompt: string;
  try {
    systemPrompt = await readFile(systemPromptPath, "utf8");
  } catch {
    return {
      ok: false,
      findings: [
        {
          code: "CODEX_UNAVAILABLE",
          severity: "error",
          message: `Codex system prompt missing at ${systemPromptPath}`,
          source: "codex",
        },
      ],
    };
  }

  const userPrompt = [
    systemPrompt.trim(),
    "",
    "## Audit request",
    `Status under review: ${input.status}`,
    "",
    "Return JSON matching the output schema. Review the SPEC DRAFT against RELATED CONTEXT.",
    "",
    "## SPEC DRAFT",
    "```markdown",
    input.markdown.trim(),
    "```",
    "",
    "## RELATED CONTEXT",
    input.relatedContext.trim() || "(no related context available)",
  ].join("\n");

  const work = await mkdtemp(path.join(tmpdir(), "spec-hub-codex-"));
  const promptFile = path.join(work, "prompt.md");
  const outFile = path.join(work, "findings.json");

  try {
    await writeFile(promptFile, userPrompt, "utf8");

    const args = [
      "exec",
      "-s",
      "read-only",
      "--json",
      "--output-schema",
      schemaPath,
      "-o",
      outFile,
      "-C",
      cwd,
      ...(model ? ["-m", model] : []),
      "-", // read prompt from stdin
    ];

    const result = await spawnCapture(bin, args, {
      cwd,
      timeoutMs,
      stdin: userPrompt,
    });

    let raw = "";
    try {
      raw = await readFile(outFile, "utf8");
    } catch {
      raw = result.stdout;
    }

    const parsed = tryParseJson(raw);
    if (!parsed) {
      const detail =
        result.stderr.trim().slice(0, 400) ||
        result.stdout.trim().slice(0, 400) ||
        `exit ${result.code}`;
      return {
        ok: false,
        findings: [
          {
            code: "CODEX_PARSE_ERROR",
            severity: "error",
            message: `Codex did not return valid findings JSON (${detail})`,
            source: "codex",
          },
        ],
      };
    }

    return normalizeFindings(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const missing =
      /ENOENT|not found|spawn/i.test(message) ||
      message.includes("CODEX_TIMEOUT");
    return {
      ok: false,
      findings: [
        {
          code: "CODEX_UNAVAILABLE",
          severity: "error",
          message: missing
            ? `Codex CLI unavailable or timed out: ${message}. Install/login Codex or set CODEX_BIN.`
            : `Codex audit failed: ${message}`,
          source: "codex",
        },
      ],
    };
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => undefined);
  }
}

function spawnCapture(
  bin: string,
  args: string[],
  opts: { cwd: string; timeoutMs: number; stdin: string },
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd: opts.cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`CODEX_TIMEOUT after ${opts.timeoutMs}ms`));
    }, opts.timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });

    child.stdin?.write(opts.stdin);
    child.stdin?.end();
  });
}
