import fs from "node:fs/promises";
import path from "node:path";
import type { StructuralGraph } from "./enrich.js";
import { defaultCorpusDir, defaultGraphOutDir, structuralGraphPath } from "./paths.js";

export type GraphQueryHit = {
  id: string;
  label: string;
  type: string;
  unresolved?: boolean;
  frontmatter?: Record<string, unknown>;
  relativePath?: string;
  body?: string;
  edges: Array<{ type: string; direction: "out" | "in"; neighbor: string }>;
};

async function loadGraph(graphPath?: string): Promise<StructuralGraph> {
  const candidates = [
    graphPath,
    path.join(defaultGraphOutDir(), "graph.json"),
    structuralGraphPath(defaultCorpusDir()),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      const raw = JSON.parse(await fs.readFile(candidate, "utf8")) as {
        directed?: boolean;
        nodes: Array<Record<string, unknown>>;
        edges: Array<Record<string, unknown>>;
        generatedAt?: string;
      };
      return {
        directed: true,
        generatedAt: raw.generatedAt ?? new Date().toISOString(),
        nodes: raw.nodes.map((n) => ({
          id: String(n.id),
          label: String(n.label ?? n.id),
          type: (n.type as StructuralGraph["nodes"][number]["type"]) ?? "Spec",
          unresolved: Boolean(n.unresolved),
          frontmatter: n.frontmatter as Record<string, unknown> | undefined,
          relativePath:
            (n.relativePath as string | undefined) ??
            (n.source_file as string | undefined),
        })),
        edges: raw.edges.map((e) => ({
          source: String(e.source),
          target: String(e.target),
          type: String(e.relation ?? e.type) as StructuralGraph["edges"][number]["type"],
        })),
      };
    } catch {
      // try next
    }
  }
  throw new Error(
    "No BookStack graph found. Run `pnpm bookstack:sync` then `pnpm bookstack:graph`.",
  );
}

function matchNode(
  graph: StructuralGraph,
  query: string,
): StructuralGraph["nodes"] {
  const q = query.toLowerCase();
  return graph.nodes.filter((n) => {
    if (n.id.toLowerCase().includes(q)) return true;
    if (n.label.toLowerCase().includes(q)) return true;
    const fm = n.frontmatter;
    if (fm && typeof fm.task_id === "string" && fm.task_id.toLowerCase().includes(q)) {
      return true;
    }
    if (fm && typeof fm.repo === "string" && fm.repo.toLowerCase().includes(q)) {
      return true;
    }
    return false;
  });
}

async function maybeLoadBody(
  relativePath: string | undefined,
  includeBody: boolean,
  corpusDir: string,
): Promise<string | undefined> {
  if (!includeBody || !relativePath) return undefined;
  try {
    const full = path.join(corpusDir, relativePath);
    const md = await fs.readFile(full, "utf8");
    const parts = md.split(/^---\r?\n/m);
    // frontmatter is between first two ---
    if (parts.length >= 3) return parts.slice(2).join("---\n").trim();
    return md;
  } catch {
    return undefined;
  }
}

/** Frontmatter-first graph query (BFS neighborhood). */
export async function graphQuery(options: {
  query: string;
  depth?: number;
  includeBody?: boolean;
  graphPath?: string;
  corpusDir?: string;
}): Promise<{ hits: GraphQueryHit[] }> {
  const graph = await loadGraph(options.graphPath);
  const corpusDir = options.corpusDir ?? defaultCorpusDir();
  const depth = options.depth ?? 1;
  const seeds = matchNode(graph, options.query);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  const adj = new Map<string, Array<{ to: string; type: string; dir: "out" | "in" }>>();
  for (const e of graph.edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    if (!adj.has(e.target)) adj.set(e.target, []);
    adj.get(e.source)!.push({ to: e.target, type: e.type, dir: "out" });
    adj.get(e.target)!.push({ to: e.source, type: e.type, dir: "in" });
  }

  const visited = new Set<string>();
  const queue: Array<{ id: string; d: number }> = seeds.map((s) => ({
    id: s.id,
    d: 0,
  }));
  const hits: GraphQueryHit[] = [];

  while (queue.length) {
    const cur = queue.shift()!;
    if (visited.has(cur.id)) continue;
    visited.add(cur.id);
    const node = byId.get(cur.id);
    if (!node) continue;

    const edges = (adj.get(cur.id) ?? []).map((e) => ({
      type: e.type,
      direction: e.dir,
      neighbor: e.to,
    }));

    hits.push({
      id: node.id,
      label: node.label,
      type: node.type,
      unresolved: node.unresolved,
      frontmatter: node.frontmatter,
      relativePath: node.relativePath,
      body: await maybeLoadBody(
        node.relativePath,
        Boolean(options.includeBody),
        corpusDir,
      ),
      edges,
    });

    if (cur.d >= depth) continue;
    for (const e of adj.get(cur.id) ?? []) {
      if (!visited.has(e.to)) queue.push({ id: e.to, d: cur.d + 1 });
    }
  }

  return { hits };
}

/** Shortest path between two node queries (BFS). */
export async function graphPath(options: {
  from: string;
  to: string;
  includeBody?: boolean;
  graphPath?: string;
  corpusDir?: string;
}): Promise<{
  found: boolean;
  path: Array<{ id: string; label: string; type: string; edgeType?: string }>;
  nodes: GraphQueryHit[];
}> {
  const graph = await loadGraph(options.graphPath);
  const corpusDir = options.corpusDir ?? defaultCorpusDir();
  const fromNodes = matchNode(graph, options.from);
  const toNodes = matchNode(graph, options.to);
  if (!fromNodes.length || !toNodes.length) {
    return { found: false, path: [], nodes: [] };
  }

  const targets = new Set(toNodes.map((n) => n.id));
  const start = fromNodes[0]!.id;
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const adj = new Map<string, Array<{ to: string; type: string }>>();
  for (const e of graph.edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    if (!adj.has(e.target)) adj.set(e.target, []);
    adj.get(e.source)!.push({ to: e.target, type: e.type });
    adj.get(e.target)!.push({ to: e.source, type: e.type });
  }

  const prev = new Map<string, { id: string; edgeType: string } | null>();
  const q = [start];
  prev.set(start, null);
  let end: string | null = null;

  while (q.length) {
    const cur = q.shift()!;
    if (targets.has(cur)) {
      end = cur;
      break;
    }
    for (const e of adj.get(cur) ?? []) {
      if (prev.has(e.to)) continue;
      prev.set(e.to, { id: cur, edgeType: e.type });
      q.push(e.to);
    }
  }

  if (!end) return { found: false, path: [], nodes: [] };

  const pathIds: Array<{ id: string; edgeType?: string }> = [];
  let walk: string | null = end;
  while (walk) {
    const p = prev.get(walk);
    pathIds.unshift({ id: walk, edgeType: p?.edgeType });
    walk = p?.id ?? null;
  }

  const path = pathIds.map((p) => {
    const n = byId.get(p.id)!;
    return { id: n.id, label: n.label, type: n.type, edgeType: p.edgeType };
  });

  const nodes: GraphQueryHit[] = [];
  for (const p of path) {
    const n = byId.get(p.id)!;
    nodes.push({
      id: n.id,
      label: n.label,
      type: n.type,
      unresolved: n.unresolved,
      frontmatter: n.frontmatter,
      relativePath: n.relativePath,
      body: await maybeLoadBody(
        n.relativePath,
        Boolean(options.includeBody),
        corpusDir,
      ),
      edges: [],
    });
  }

  return { found: true, path, nodes };
}

export async function graphSummary(options?: {
  graphPath?: string;
}): Promise<{
  generatedAt: string;
  nodeCount: number;
  edgeCount: number;
  byType: Record<string, number>;
  edgeTypes: Record<string, number>;
  unresolvedContracts: string[];
}> {
  const graph = await loadGraph(options?.graphPath);
  const byType: Record<string, number> = {};
  const edgeTypes: Record<string, number> = {};
  for (const n of graph.nodes) {
    byType[n.type] = (byType[n.type] ?? 0) + 1;
  }
  for (const e of graph.edges) {
    edgeTypes[e.type] = (edgeTypes[e.type] ?? 0) + 1;
  }
  return {
    generatedAt: graph.generatedAt,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    byType,
    edgeTypes,
    unresolvedContracts: graph.nodes
      .filter((n) => n.type === "Contract" && n.unresolved)
      .map((n) => n.label),
  };
}
