import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  enrichStructuralGraph,
  graphPath,
  graphQuery,
  syncBookstackCorpus,
} from "@spec-hub/bookstack-graph";
import {
  createBookStackClient,
  hasBookStackConfig,
} from "../bookstack/index.js";

async function fetchApiPages() {
  const client = createBookStackClient();
  const shelves = await client.listShelves(100);
  const shelfByBook = new Map<number, string>();
  for (const shelf of shelves.data) {
    const full = await client.getShelf(shelf.id);
    for (const book of full.books ?? []) {
      shelfByBook.set(book.id, shelf.name);
    }
  }

  const books = await client.listBooks(100);
  const bookName = new Map(books.data.map((b) => [b.id, b.name]));

  const pages: Array<{
    shelf: string;
    book: string;
    name: string;
    markdown: string;
    updatedAt?: string;
  }> = [];

  let offset = 0;
  for (; ;) {
    const batch = await client.listPages(100, offset);
    for (const summary of batch.data) {
      const page = await client.getPage(summary.id);
      pages.push({
        shelf: shelfByBook.get(summary.book_id) ?? "Unshelved",
        book: bookName.get(summary.book_id) ?? `book-${summary.book_id}`,
        name: page.name,
        markdown: page.markdown ?? `# ${page.name}\n`,
        updatedAt: page.updated_at,
      });
    }
    offset += batch.data.length;
    if (offset >= batch.total || batch.data.length === 0) break;
  }

  return pages;
}

export function registerGraphTools(server: McpServer): void {
  server.tool(
    "bookstack_sync_graph",
    "Sync BookStack/fixtures corpus and rebuild the typed knowledge graph",
    {
      source: z.enum(["fixtures", "api"]).default("fixtures"),
    },
    async (args) => {
      let sync;
      if (args.source === "api") {
        if (!hasBookStackConfig()) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    status: "error",
                    message:
                      "API sync requires BOOKSTACK_URL + BOOKSTACK_TOKEN_ID + BOOKSTACK_TOKEN_SECRET. Use source=fixtures offline.",
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }
        const apiPages = await fetchApiPages();
        sync = await syncBookstackCorpus({ source: "api", apiPages });
      } else {
        sync = await syncBookstackCorpus({ source: "fixtures" });
      }

      const graph = await enrichStructuralGraph({ corpusDir: sync.corpusDir });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                status: sync.rejected.length ? "completed_with_rejects" : "ok",
                sync: {
                  pageCount: sync.pageCount,
                  publishes: sync.publishes,
                  rejected: sync.rejected,
                  gateFindings: sync.gateFindings,
                },
                graph: {
                  nodes: graph.nodes.length,
                  edges: graph.edges.length,
                  generatedAt: graph.generatedAt,
                },
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    "graph_query",
    "Frontmatter-first BookStack graph query (set include_body for full markdown)",
    {
      query: z.string().min(1),
      depth: z.number().int().min(0).max(5).default(1),
      include_body: z.boolean().default(false),
    },
    async (args) => {
      const result = await graphQuery({
        query: args.query,
        depth: args.depth,
        includeBody: args.include_body,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    "graph_path",
    "Shortest path between two BookStack graph nodes (frontmatter-first)",
    {
      from: z.string().min(1),
      to: z.string().min(1),
      include_body: z.boolean().default(false),
    },
    async (args) => {
      const result = await graphPath({
        from: args.from,
        to: args.to,
        includeBody: args.include_body,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );
}
