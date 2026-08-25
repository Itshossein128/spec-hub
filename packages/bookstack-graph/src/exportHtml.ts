import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultGraphOutDir, repoRoot } from "./paths.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function resolvePython(): string {
  const candidates = [
    path.join(repoRoot(), "graphify-out", ".graphify_python"),
    path.join(defaultGraphOutDir(), ".graphify_python"),
  ];
  for (const marker of candidates) {
    if (fs.existsSync(marker)) {
      const py = fs.readFileSync(marker, "utf8").trim();
      if (py) return py;
    }
  }
  return process.env.GRAPHIFY_PYTHON?.trim() || "python3";
}

/**
 * Render interactive vis.js HTML via graphify.export.to_html.
 * Input: graphify-out/bookstack/graph.json (structural enricher output).
 */
export function exportGraphifyHtml(options?: {
  graphJsonPath?: string;
  htmlOutPath?: string;
}): { htmlPath: string; stdout: string } {
  const graphJsonPath =
    options?.graphJsonPath ?? path.join(defaultGraphOutDir(), "graph.json");
  const htmlOutPath =
    options?.htmlOutPath ?? path.join(defaultGraphOutDir(), "graph.html");
  const script = path.join(here, "..", "scripts", "export_graphify_html.py");
  const python = resolvePython();

  const result = spawnSync(
    python,
    [script, graphJsonPath, htmlOutPath],
    { encoding: "utf8" },
  );

  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
    throw new Error(
      `graphify HTML export failed (python=${python}):\n${detail || "unknown error"}`,
    );
  }

  return {
    htmlPath: htmlOutPath,
    stdout: (result.stdout ?? "").trim(),
  };
}
