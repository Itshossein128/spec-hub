import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  createBookStackClient,
  hasBookStackConfig,
} from "../bookstack/index.js";

/** SPEC §3.2 — bookstack://books/{book_id}/contracts */
export function registerBookContractsResource(server: McpServer): void {
  server.resource(
    "book-contracts",
    new ResourceTemplate("bookstack://books/{book_id}/contracts", {
      list: undefined,
    }),
    async (uri, { book_id }) => {
      if (!hasBookStackConfig()) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/markdown",
              text: `# Book ${book_id} contracts\n\n_BookStack API tokens not configured. Use graph://bookstack/summary after fixture sync._\n`,
            },
          ],
        };
      }
      const client = createBookStackClient();
      const book = await client.getBook(Number(book_id));
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: `# Book: ${book.name}\n\nContract catalog pages should declare \`publishes\` in Agent-Ready frontmatter. Fetch pages via search/tools for full lists.\n`,
          },
        ],
      };
    },
  );
}
