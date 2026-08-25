#!/usr/bin/env node
import { enrichStructuralGraph } from "./enrich.js";
import { exportGraphifyHtml } from "./exportHtml.js";
import { syncBookstackCorpus } from "./sync.js";
import { defaultFixturesDir } from "./paths.js";

async function main() {
  const [, , cmd, ...rest] = process.argv;
  const fixtures = rest.includes("--fixtures") || rest.includes("--source=fixtures");
  const update = rest.includes("--update");
  const skipHtml = rest.includes("--no-html");

  if (cmd === "sync") {
    const result = await syncBookstackCorpus({
      source: fixtures || !process.env.BOOKSTACK_TOKEN_ID ? "fixtures" : "api",
      fixturesDir: defaultFixturesDir(),
    });
    console.log(
      JSON.stringify(
        {
          status: result.rejected.length ? "completed_with_rejects" : "ok",
          ...result,
        },
        null,
        2,
      ),
    );
    if (result.pageCount === 0) process.exit(1);
    return;
  }

  if (cmd === "graph") {
    if (!update) {
      // ensure corpus exists via fixtures if empty
      try {
        await syncBookstackCorpus({ source: "fixtures" });
      } catch {
        // corpus may already exist from prior sync
      }
    }
    const graph = await enrichStructuralGraph();
    let htmlPath: string | undefined;
    let htmlLog: string | undefined;
    if (!skipHtml) {
      const viz = exportGraphifyHtml();
      htmlPath = viz.htmlPath;
      htmlLog = viz.stdout;
      if (htmlLog) console.error(htmlLog);
    }
    console.log(
      JSON.stringify(
        {
          status: "ok",
          nodes: graph.nodes.length,
          edges: graph.edges.length,
          generatedAt: graph.generatedAt,
          html: htmlPath,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.error(
    `Usage: bookstack-graph <sync|graph> [--fixtures] [--update] [--no-html]`,
  );
  process.exit(2);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
