import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Monorepo root (packages/bookstack-graph/src → ../../..) */
export function repoRoot(from = here): string {
  return path.resolve(from, "../../..");
}

export function defaultCorpusDir(root = repoRoot()): string {
  return path.join(root, "data", "bookstack-corpus");
}

export function defaultFixturesDir(root = repoRoot()): string {
  return path.join(root, "packages", "bookstack-graph", "fixtures");
}

export function defaultGraphOutDir(root = repoRoot()): string {
  return path.join(root, "graphify-out", "bookstack");
}

export function structuralGraphPath(corpusDir: string): string {
  return path.join(corpusDir, ".structural-graph.json");
}

export function syncManifestPath(corpusDir: string): string {
  return path.join(corpusDir, ".sync-manifest.json");
}
