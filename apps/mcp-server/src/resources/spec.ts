import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

/** SPEC §3.2 — bookstack://specs/{task_id} */
export function registerSpecResource(server: McpServer): void {
  server.resource(
    "spec",
    new ResourceTemplate("bookstack://specs/{task_id}", {
      list: undefined,
    }),
    async (uri, { task_id }) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: `# Spec ${task_id}\n\n_Not implemented — BookStack client pending._\n`,
        },
      ],
    }),
  );
}
