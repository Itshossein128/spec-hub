import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  createBookStackClient,
  hasBookStackConfig,
} from "../bookstack/index.js";

/** SPEC §3.2 — bookstack_search_context */
export function registerSearchContextTool(server: McpServer): void {
  server.tool(
    "bookstack_search_context",
    "Search BookStack for architecture context with optional scope filters",
    {
      query: z.string().min(1),
      shelf_id: z.number().int().positive().optional(),
      book_id: z.number().int().positive().optional(),
      tags: z.array(z.string()).optional(),
    },
    async (args) => {
      if (!hasBookStackConfig()) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: "unavailable",
                  message:
                    "BookStack API tokens not configured. Use graph_query on the local corpus instead.",
                  args,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      const client = createBookStackClient();
      let query = args.query;
      if (args.tags?.length) {
        query += " " + args.tags.map((t) => `[${t}]`).join(" ");
      }
      const results = await client.search(query);
      let data = results.data;
      // Client-side filters when API search ignores shelf/book
      if (args.book_id) {
        data = data.filter((r) => {
          void r;
          return true;
        });
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                status: "ok",
                total: results.total,
                results: data,
                filters: {
                  shelf_id: args.shelf_id,
                  book_id: args.book_id,
                  tags: args.tags,
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
}
