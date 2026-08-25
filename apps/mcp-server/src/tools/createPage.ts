import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/** SPEC §3.2 — bookstack_create_page (stub; BookStack API wiring in Milestone 1). */
export function registerCreatePageTool(server: McpServer): void {
  server.tool(
    "bookstack_create_page",
    "Create a BookStack page from markdown content and tags",
    {
      book_id: z.number().int().positive(),
      chapter_id: z.number().int().positive().optional(),
      title: z.string().min(1),
      markdown_content: z.string().min(1),
      tags: z.array(z.string()).default([]),
    },
    async (args) => {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                status: "not_implemented",
                message:
                  "BookStack API client not wired yet. Payload accepted for scaffolding.",
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
