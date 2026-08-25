import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

/** SPEC §3.2 — bookstack://shelves/{shelf_id}/summary */
export function registerShelfSummaryResource(server: McpServer): void {
  server.resource(
    "shelf-summary",
    new ResourceTemplate("bookstack://shelves/{shelf_id}/summary", {
      list: undefined,
    }),
    async (uri, { shelf_id }) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: `# Shelf ${shelf_id} summary\n\n_Not implemented — BookStack client pending._\n`,
        },
      ],
    }),
  );
}
