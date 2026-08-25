import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

/** SPEC §3.2 — bookstack://books/{book_id}/contracts */
export function registerBookContractsResource(server: McpServer): void {
  server.resource(
    "book-contracts",
    new ResourceTemplate("bookstack://books/{book_id}/contracts", {
      list: undefined,
    }),
    async (uri, { book_id }) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: `# Book ${book_id} contracts\n\n_Not implemented — BookStack client pending._\n`,
        },
      ],
    }),
  );
}
