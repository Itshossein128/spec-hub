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
import {
  oneSentenceDescription,
  upsertMasterIndexEntry,
} from "../bookstack/master-index.js";

/** SPEC §3.2 — bookstack_create_page */
export function registerCreatePageTool(server: McpServer): void {
  server.tool(
    "bookstack_create_page",
    "Create a BookStack page from markdown content and tags; updates parent Master Index",
    {
      book_id: z.number().int().positive(),
      chapter_id: z.number().int().positive().optional(),
      title: z.string().min(1),
      markdown_content: z.string().min(1),
      tags: z.array(z.string()).default([]),
      publishes_catalog: z.array(z.string()).optional(),
    },
    async (args) => {
      const parsed = safeParseAgentSpecMarkdown(args.markdown_content);
      if (parsed.success) {
        const fm = parsed.data.frontmatter;
        const hierarchy = assertHierarchyPlacement(
          {
            shelf: fm.shelf,
            book: fm.book,
            chapter: fm.chapter,
            bookId: args.book_id,
            chapterId: args.chapter_id,
            status: fm.status,
          },
          { statusOverride: fm.status },
        );
        if (!hierarchy.ok) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    status: "rejected",
                    reason: "hierarchy",
                    findings: hierarchy.findings,
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }

        const catalog = new Set(
          (args.publishes_catalog ?? []).map(normalizeContractId),
        );
        for (const p of fm.publishes ?? []) {
          catalog.add(normalizeContractId(p));
        }
        const gate = assertConsumesResolved(fm, {
          publishes: catalog,
        });
        if (!gate.ok) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    status: "rejected",
                    reason: "consume_integrity",
                    findings: gate.findings,
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }

        if (fm.status === "Ready-For-Agent" || fm.status === "Done") {
          const relatedContext = [
            `### Placement`,
            `- shelf: ${fm.shelf}`,
            `- book: ${fm.book}`,
            `- chapter: ${fm.chapter ?? "(none)"}`,
            "",
            "### Publishes catalog",
            ...[...catalog].slice(0, 40).map((id) => `- ${id}`),
          ].join("\n");
          const codex = await analyzeSpecification({
            markdown: args.markdown_content,
            relatedContext,
            status: fm.status,
            unavailableSeverity: "error",
          });
          if (!codex.ok) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    {
                      status: "rejected",
                      reason: "codex_audit",
                      findings: codex.findings,
                    },
                    null,
                    2,
                  ),
                },
              ],
              isError: true,
            };
          }
        }
      }

      if (!hasBookStackConfig()) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: "validated_local_only",
                  message:
                    "BookStack API tokens missing; page not created. Spec parsed/gated locally.",
                  schemaOk: parsed.success,
                  args: {
                    book_id: args.book_id,
                    title: args.title,
                    tags: args.tags,
                  },
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      const client = createBookStackClient();
      const page = await client.createPage({
        book_id: args.book_id,
        chapter_id: args.chapter_id,
        name: args.title,
        markdown: args.markdown_content,
        tags: args.tags.map((name) => ({ name })),
      });

      const mission = parsed.success
        ? (parsed.data.body.match(/(?:Goal|هدف)[:\s]*([^\n]+)/i)?.[1] ?? "")
        : "";
      const index = await upsertMasterIndexEntry(client, {
        bookId: args.book_id,
        chapterId: args.chapter_id,
        entryTitle: page.name,
        entryEntityId: page.id,
        description: oneSentenceDescription(
          mission,
          `Agent-Ready spec: ${page.name}`,
        ),
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { status: "created", page, masterIndex: index },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
