import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  createBookStackClient,
  hasBookStackConfig,
} from "../bookstack/index.js";

/** SPEC §3.2 — bookstack://specs/{task_id} */
export function registerSpecResource(server: McpServer): void {
  server.resource(
    "spec",
    new ResourceTemplate("bookstack://specs/{task_id}", {
      list: undefined,
    }),
    async (uri, { task_id }) => {
      if (!hasBookStackConfig()) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/markdown",
              text: `# Spec ${task_id}\n\n_BookStack API tokens not configured. Query local graph with graph_query._\n`,
            },
          ],
        };
      }
      const client = createBookStackClient();
      const results = await client.search(String(task_id));
      const hit = results.data[0];
      if (!hit || hit.type !== "page") {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/markdown",
              text: `# Spec ${task_id}\n\n_Not found in BookStack search._\n`,
            },
          ],
        };
      }
      const page = await client.getPage(hit.id);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: page.markdown ?? `# ${page.name}\n\n_No markdown body._\n`,
          },
        ],
      };
    },
  );
}
