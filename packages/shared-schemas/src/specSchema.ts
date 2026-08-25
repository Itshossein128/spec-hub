import { z } from "zod";

/** Frontmatter enums aligned with AGENT_SPEC.md / SPEC.md §4. */
export const AgentSpecStatusSchema = z.enum([
  "Draft",
  "In-Review",
  "Ready-For-Agent",
  "Done",
  "Blocked",
]);

export const AgentSpecComplexitySchema = z.enum([
  "Trivial",
  "Standard",
  "Complex",
  "Architectural",
]);

const stringList = z.array(z.string().min(1)).default([]);

/**
 * Controlled tag helpers. Tags are filters only — not typed graph edges.
 * Agent-Ready pages should include at least one `repo:` and one `domain:` tag.
 */
export function hasRepoTag(tags: string[]): boolean {
  return tags.some((t) => /^repo:[^\s]+$/i.test(t));
}

export function hasDomainTag(tags: string[]): boolean {
  return tags.some((t) => /^domain:[^\s]+$/i.test(t));
}

/** Normalize contract / relation IDs (trim; preserve compact forms). */
export function normalizeContractId(id: string): string {
  return id.trim();
}

export function isExternalContract(id: string): boolean {
  return normalizeContractId(id).toLowerCase().startsWith("external:");
}

export const AgentSpecFrontmatterSchema = z
  .object({
    task_id: z
      .string()
      .min(1)
      .regex(/^TSK-[\w-]+$/i, 'task_id must look like "TSK-2026-08"'),
    title: z.string().min(5).max(120),
    repo: z.string().min(1).optional(),
    shelf: z.string().min(1),
    book: z.string().min(1),
    chapter: z.string().min(1).optional(),
    tags: z.array(z.string().min(1)).min(1),
    status: AgentSpecStatusSchema,
    complexity: AgentSpecComplexitySchema,
    owner: z.string().min(1),
    publishes: stringList,
    consumes: stringList,
    impacts: stringList,
    depends_on: stringList,
  })
  .superRefine((fm, ctx) => {
    const agentReady =
      fm.status === "Ready-For-Agent" || fm.status === "Done";
    if (!agentReady) return;

    if (!fm.chapter?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["chapter"],
        message:
          "Ready-For-Agent specs require a Chapter (module / business entity)",
      });
    }
    if (!hasRepoTag(fm.tags)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tags"],
        message:
          'Ready-For-Agent specs require a controlled tag like "repo:<service>"',
      });
    }
    if (!hasDomainTag(fm.tags)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tags"],
        message:
          'Ready-For-Agent specs require a controlled tag like "domain:<context>"',
      });
    }
  });

export type AgentSpecFrontmatter = z.infer<typeof AgentSpecFrontmatterSchema>;

/**
 * Required body sections. Matches bilingual AGENT_SPEC.md headings and
 * English-only SPEC.md §4 headings via English keywords in parentheses or alone.
 */
export const REQUIRED_AGENT_SPEC_SECTIONS = [
  {
    id: "mission_guardrails",
    label: "Mission & Guardrails",
    pattern: /##\s+.*(Mission\s*&\s*Guardrails)/i,
  },
  {
    id: "existing_utilities",
    label: "Existing Utilities",
    pattern: /##\s+.*(Existing\s+Utilities)/i,
  },
  {
    id: "data_contracts",
    label: "Data Contracts",
    pattern: /##\s+.*(Data\s+Contracts)/i,
  },
  {
    id: "acceptance_criteria",
    label: "Acceptance Criteria",
    pattern: /##\s+.*(Acceptance\s+Criteria)/i,
  },
] as const;

export const AgentSpecBodySchema = z
  .string()
  .min(1)
  .superRefine((body, ctx) => {
    if (!/^#\s+Specification\s*:/m.test(body)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Body must start with an H1 of the form "# Specification: …"',
      });
    }

    for (const section of REQUIRED_AGENT_SPEC_SECTIONS) {
      if (!section.pattern.test(body)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Missing required section: ${section.label}`,
        });
      }
    }

    const hasMissionBits =
      /\*\*\s*Goal\s*:\s*\*\*/i.test(body) &&
      /Allowed\s+Scope/i.test(body) &&
      /Protected\s+Scope/i.test(body) &&
      /Non-Goals/i.test(body);

    if (!hasMissionBits) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Mission & Guardrails must include Goal, Allowed Scope, Protected Scope, and Non-Goals",
      });
    }

    const hasGherkin =
      /\*\*\s*Scenario\b/i.test(body) &&
      /\*\*\s*Given\s*\*\*/i.test(body) &&
      /\*\*\s*When\s*\*\*/i.test(body) &&
      /\*\*\s*Then\s*\*\*/i.test(body);

    if (!hasGherkin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Acceptance Criteria must include at least one Gherkin Scenario with Given / When / Then",
      });
    }
  });

export const AgentSpecDocumentSchema = z.object({
  frontmatter: AgentSpecFrontmatterSchema,
  body: AgentSpecBodySchema,
});

export type AgentSpecDocument = z.infer<typeof AgentSpecDocumentSchema>;

const FRONTMATTER_BLOCK =
  /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

/**
 * Minimal YAML subset parser for AGENT_SPEC frontmatter
 * (scalars, inline arrays, and block list arrays).
 */
export function parseAgentSpecFrontmatterYaml(
  yamlBlock: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yamlBlock.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i]!;
    const line = rawLine.trim();
    i += 1;
    if (!line || line.startsWith("#")) continue;

    const match = /^([A-Za-z_][\w]*)\s*:\s*(.*)$/.exec(line);
    if (!match?.[1]) {
      throw new Error(`Unsupported frontmatter line: ${rawLine}`);
    }

    const key = match[1];
    const value = (match[2] ?? "").trim();

    if (value.startsWith("[")) {
      const inner = value.replace(/^\[/, "").replace(/\]$/, "").trim();
      result[key] = inner
        ? inner.split(",").map((part) => unquote(part.trim())).filter(Boolean)
        : [];
      continue;
    }

    if (value === "" || value === "|" || value === ">") {
      const items: string[] = [];
      while (i < lines.length) {
        const next = lines[i]!;
        const trimmed = next.trim();
        if (!trimmed || trimmed.startsWith("#")) {
          i += 1;
          continue;
        }
        const listItem = /^-\s+(.*)$/.exec(trimmed);
        if (!listItem) break;
        items.push(unquote((listItem[1] ?? "").trim()));
        i += 1;
      }
      result[key] = items;
      continue;
    }

    result[key] = unquote(value);
  }

  return result;
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export function splitAgentSpecMarkdown(markdown: string): {
  frontmatterRaw: string;
  body: string;
} {
  const match = FRONTMATTER_BLOCK.exec(markdown.trim());
  if (!match) {
    throw new Error(
      "Agent spec markdown must begin with a YAML frontmatter block delimited by ---",
    );
  }
  return { frontmatterRaw: match[1]!, body: match[2]!.trim() };
}

/** Parse + validate a full AGENT_SPEC markdown document. */
export function parseAgentSpecMarkdown(markdown: string): AgentSpecDocument {
  const { frontmatterRaw, body } = splitAgentSpecMarkdown(markdown);
  const raw = parseAgentSpecFrontmatterYaml(frontmatterRaw);
  return AgentSpecDocumentSchema.parse({ frontmatter: raw, body });
}

export function safeParseAgentSpecMarkdown(markdown: string) {
  try {
    const { frontmatterRaw, body } = splitAgentSpecMarkdown(markdown);
    const raw = parseAgentSpecFrontmatterYaml(frontmatterRaw);
    return AgentSpecDocumentSchema.safeParse({ frontmatter: raw, body });
  } catch (error) {
    return {
      success: false as const,
      error: new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: [],
          message: error instanceof Error ? error.message : String(error),
        },
      ]),
    };
  }
}
