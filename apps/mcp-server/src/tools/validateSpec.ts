import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  analyzeSpecification,
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

/** SPEC §3.2 — bookstack_validate_spec (+ hierarchy + consume + Codex). */
export function registerValidateSpecTool(server: McpServer): void {
  server.tool(
    "bookstack_validate_spec",
    "Validate Agent-Ready structure, hierarchy, consume integrity, and Codex CLI review",
    {
      page_id: z.number().int().positive().optional(),
      markdown: z.string().min(1).optional(),
      publishes_catalog: z.array(z.string()).optional(),
      run_codex: z.boolean().default(true),
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
      const localOk = findings.every((f) => f.severity !== "error");

      if (args.run_codex !== false) {
        const relatedContext = [
          `### Placement`,
          `- shelf: ${fm.shelf}`,
          `- book: ${fm.book}`,
          `- chapter: ${fm.chapter ?? "(none)"}`,
          `- status: ${fm.status}`,
          "",
          "### Publishes catalog",
          ...[...catalogPublishes].slice(0, 40).map((id) => `- ${id}`),
        ].join("\n");

        const soft =
          fm.status !== "Ready-For-Agent" && fm.status !== "Done";
        const codex = await analyzeSpecification({
          markdown,
          relatedContext,
          status: fm.status,
          unavailableSeverity: soft ? "warning" : "error",
        });
        findings.push(...codex.findings);
      }

      const ok = findings.every((f) => f.severity !== "error");

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                ok,
                localOk,
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
