import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/** SPEC §3.2 — bookstack_validate_spec (stub). */
export function registerValidateSpecTool(server: McpServer): void {
  server.tool(
    "bookstack_validate_spec",
    "Validate that a BookStack page follows the Agent-Ready specification structure",
    {
      page_id: z.number().int().positive(),
    },
    async (args) => {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                status: "not_implemented",
                message: "Spec validation against BookStack not wired yet.",
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
