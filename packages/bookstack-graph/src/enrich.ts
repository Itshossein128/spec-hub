import fs from "node:fs/promises";
import path from "node:path";
import {
  isExternalContract,
  normalizeContractId,
  safeParseAgentSpecMarkdown,
} from "@spec-hub/shared-schemas";
import { buildPublishesCatalog } from "./catalog.js";
import {
  defaultCorpusDir,
  defaultGraphOutDir,
  structuralGraphPath,
} from "./paths.js";

export type GraphNode = {
  id: string;
  label: string;
  type:
  | "Shelf"
  | "Book"
  | "Page"
  | "Spec"
  | "Tag"
  | "Repo"
  | "Contract"
  | "ImpactTarget"
  | "Path";
  unresolved?: boolean;
  frontmatter?: Record<string, unknown>;
  relativePath?: string;
};

export type GraphEdge = {
  source: string;
  target: string;
  type:
  | "CONTAINS"
  | "TAGGED_WITH"
  | "OWNED_BY"
  | "PUBLISHES"
  | "CONSUMES"
  | "IMPACTS"
  | "DEPENDS_ON"
  | "REFERENCES";
};

export type StructuralGraph = {
  directed: true;
  generatedAt: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

function nodeId(type: string, key: string): string {
  return `${type}:${key}`;
}

async function listMarkdownFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(current: string) {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".")) continue;
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        out.push(full);
      }
    }
  }
  await walk(dir);
  return out;
}

function extractAllowedPaths(body: string): string[] {
  const paths: string[] = [];
  const section =
    /Allowed\s+Scope[\s\S]*?(?=Protected\s+Scope|Non-Goals|##\s|$)/i.exec(body);
  if (!section) return paths;
  const re = /`([^`]+)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(section[0]!))) {
    const p = m[1]!.trim();
    if (p.includes("/") || p.endsWith(".ts") || p.endsWith(".tsx")) {
      paths.push(p);
    }
  }
  return paths;
}

/**
 * Emit typed structural edges from Agent-Ready frontmatter.
 * Orphan draft consumes → Contract node with unresolved: true.
 */
export async function enrichStructuralGraph(options?: {
  corpusDir?: string;
  graphOutDir?: string;
}): Promise<StructuralGraph> {
  const corpusDir = options?.corpusDir ?? defaultCorpusDir();
  const graphOutDir = options?.graphOutDir ?? defaultGraphOutDir();

  const files = await listMarkdownFiles(corpusDir);
  const pages: Array<{ relativePath: string; markdown: string }> = [];
  for (const file of files) {
    pages.push({
      relativePath: path.relative(corpusDir, file).replace(/\\/g, "/"),
      markdown: await fs.readFile(file, "utf8"),
    });
  }

  const catalog = buildPublishesCatalog(pages);
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  const ensure = (node: GraphNode) => {
    if (!nodes.has(node.id)) nodes.set(node.id, node);
    return node.id;
  };

  for (const page of catalog.byTask.values()) {
    const fm = page.frontmatter;
    const shelfId = ensure({
      id: nodeId("Shelf", fm.shelf),
      label: fm.shelf,
      type: "Shelf",
    });
    const bookId = ensure({
      id: nodeId("Book", `${fm.shelf}/${fm.book}`),
      label: fm.book,
      type: "Book",
    });
    const specId = ensure({
      id: nodeId("Spec", fm.task_id),
      label: fm.title,
      type: "Spec",
      frontmatter: { ...fm },
      relativePath: page.relativePath,
    });
    // Page alias for hierarchy queries
    ensure({
      id: nodeId("Page", fm.task_id),
      label: fm.title,
      type: "Page",
      frontmatter: { ...fm },
      relativePath: page.relativePath,
    });

    edges.push({ source: shelfId, target: bookId, type: "CONTAINS" });
    edges.push({ source: bookId, target: specId, type: "CONTAINS" });

    for (const tag of fm.tags) {
      const tid = ensure({
        id: nodeId("Tag", tag),
        label: tag,
        type: "Tag",
      });
      edges.push({ source: specId, target: tid, type: "TAGGED_WITH" });
    }

    if (fm.repo) {
      const rid = ensure({
        id: nodeId("Repo", fm.repo),
        label: fm.repo,
        type: "Repo",
      });
      edges.push({ source: specId, target: rid, type: "OWNED_BY" });
    }

    for (const raw of fm.publishes ?? []) {
      const cid = normalizeContractId(raw);
      const contractNode = ensure({
        id: nodeId("Contract", cid),
        label: cid,
        type: "Contract",
        unresolved: false,
      });
      edges.push({ source: specId, target: contractNode, type: "PUBLISHES" });
    }

    for (const raw of fm.consumes ?? []) {
      const cid = normalizeContractId(raw);
      const resolved =
        isExternalContract(cid) || catalog.publishes.has(cid);
      const contractNode = ensure({
        id: nodeId("Contract", cid),
        label: cid,
        type: "Contract",
        unresolved: !resolved,
      });
      // If already present as resolved, don't flip back to unresolved
      const existing = nodes.get(contractNode)!;
      if (resolved) existing.unresolved = false;
      edges.push({ source: specId, target: contractNode, type: "CONSUMES" });
    }

    for (const raw of fm.impacts ?? []) {
      const target = normalizeContractId(raw);
      const tid = ensure({
        id: nodeId("ImpactTarget", target),
        label: target,
        type: "ImpactTarget",
      });
      edges.push({ source: specId, target: tid, type: "IMPACTS" });
    }

    for (const dep of fm.depends_on ?? []) {
      const depId = nodeId("Spec", dep);
      ensure({
        id: depId,
        label: dep,
        type: "Spec",
      });
      edges.push({ source: specId, target: depId, type: "DEPENDS_ON" });
    }

    for (const p of extractAllowedPaths(page.body)) {
      const pid = ensure({
        id: nodeId("Path", p),
        label: p,
        type: "Path",
      });
      edges.push({ source: specId, target: pid, type: "REFERENCES" });
    }
  }

  const graph: StructuralGraph = {
    directed: true,
    generatedAt: new Date().toISOString(),
    nodes: [...nodes.values()],
    edges,
  };

  await fs.writeFile(
    structuralGraphPath(corpusDir),
    JSON.stringify(graph, null, 2),
    "utf8",
  );

  await fs.mkdir(graphOutDir, { recursive: true });
  // graphify-compatible shape used by MCP path/query tools
  const graphifyGraph = {
    directed: true,
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      type: n.type,
      unresolved: n.unresolved,
      community: n.type,
      source_file: n.relativePath,
      frontmatter: n.frontmatter,
    })),
    edges: graph.edges.map((e) => ({
      source: e.source,
      target: e.target,
      relation: e.type,
      type: e.type,
    })),
  };
  await fs.writeFile(
    path.join(graphOutDir, "graph.json"),
    JSON.stringify(graphifyGraph, null, 2),
    "utf8",
  );
  await fs.writeFile(
    path.join(graphOutDir, "GRAPH_REPORT.md"),
    `# BookStack knowledge graph\n\nGenerated: ${graph.generatedAt}\n\n- Nodes: ${graph.nodes.length}\n- Edges: ${graph.edges.length}\n- Specs: ${catalog.byTask.size}\n- Publishes: ${catalog.publishes.size}\n\nInteractive viz: open \`graph.html\` in this directory (graphify vis.js export).\n`,
    "utf8",
  );

  return graph;
}
