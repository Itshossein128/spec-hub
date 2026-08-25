import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  createBookStackClient,
  hasBookStackConfig,
} from "../bookstack/index.js";

/** SPEC §3.2 — bookstack://shelves/{shelf_id}/summary */
export function registerShelfSummaryResource(server: McpServer): void {
  server.resource(
    "shelf-summary",
    new ResourceTemplate("bookstack://shelves/{shelf_id}/summary", {
      list: undefined,
    }),
    async (uri, { shelf_id }) => {
      if (!hasBookStackConfig()) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/markdown",
              text: `# Shelf ${shelf_id} summary\n\n_BookStack API tokens not configured._\n`,
            },
          ],
        };
      }
      const client = createBookStackClient();
      const shelf = await client.getShelf(Number(shelf_id));
      const books =
        shelf.books?.map((b) => `- ${b.name} (id=${b.id})`).join("\n") ??
        "_No books embedded; list via API._";
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: `# Shelf: ${shelf.name}\n\n${shelf.description ?? ""}\n\n## Books\n\n${books}\n`,
          },
        ],
      };
    },
  );
}
