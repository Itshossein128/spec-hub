import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { graphSummary } from "@spec-hub/bookstack-graph";

/** graph://bookstack/summary — compact graph stats for agents */
export function registerGraphSummaryResource(server: McpServer): void {
  server.resource("graph-summary", "graph://bookstack/summary", async (uri) => {
    try {
      const summary = await graphSummary();
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(summary, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                error: err instanceof Error ? err.message : String(err),
                hint: "Run pnpm bookstack:sync && pnpm bookstack:graph",
              },
              null,
              2,
            ),
          },
        ],
      };
    }
  });
}
