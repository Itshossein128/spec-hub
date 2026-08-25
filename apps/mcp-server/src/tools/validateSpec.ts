import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  assertConsumesResolved,
  assertHierarchyPlacement,
} from "@spec-hub/codex-gate";
import {
  normalizeContractId,
  safeParseAgentSpecMarkdown,
} from "@spec-hub/shared-schemas";
import {
  createBookStackClient,
  hasBookStackConfig,
} from "../bookstack/index.js";

/** SPEC §3.2 — bookstack_validate_spec (+ consume integrity + hierarchy). */
export function registerValidateSpecTool(server: McpServer): void {
  server.tool(
    "bookstack_validate_spec",
    "Validate Agent-Ready structure, hierarchy placement, and publish-before-consume integrity",
    {
      page_id: z.number().int().positive().optional(),
      markdown: z.string().min(1).optional(),
      publishes_catalog: z.array(z.string()).optional(),
    },
    async (args) => {
      let markdown = args.markdown;
      if (!markdown && args.page_id != null) {
        if (!hasBookStackConfig()) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    ok: false,
                    error:
                      "BOOKSTACK_TOKEN_* not configured; pass markdown instead of page_id",
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }
        const client = createBookStackClient();
        const page = await client.getPage(args.page_id);
        markdown = page.markdown ?? "";
      }

      if (!markdown) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { ok: false, error: "Provide markdown or page_id" },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }

      const parsed = safeParseAgentSpecMarkdown(markdown);
      if (!parsed.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  ok: false,
                  schemaErrors: parsed.error.issues.map((i) => ({
                    path: i.path.join("."),
                    message: i.message,
                  })),
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      const fm = parsed.data.frontmatter;
      const hierarchy = assertHierarchyPlacement(fm, {
        statusOverride: fm.status,
      });

      const catalogPublishes = new Set(
        (args.publishes_catalog ?? []).map(normalizeContractId),
      );
      for (const p of fm.publishes ?? []) {
        catalogPublishes.add(normalizeContractId(p));
      }

      const gate = assertConsumesResolved(fm, {
        publishes: catalogPublishes,
      });

      const findings = [...hierarchy.findings, ...gate.findings];
      const ok = findings.every((f) => f.severity !== "error");

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                ok,
                frontmatter: fm,
                findings,
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
