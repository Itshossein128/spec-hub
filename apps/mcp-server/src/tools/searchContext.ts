import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/** SPEC §3.2 — bookstack_search_context (stub). */
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
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                status: "not_implemented",
                message: "BookStack search not wired yet.",
                args,
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
