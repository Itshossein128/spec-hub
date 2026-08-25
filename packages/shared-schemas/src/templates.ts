export function renderAgentReadyMarkdown(data: {
  taskId: string;
  title: string;
  repo?: string;
  shelf: string;
  book: string;
  chapter?: string;
  tags: string[];
  status?: string;
  complexity: string;
  owner: string;
  publishes?: string[];
  consumes?: string[];
  impacts?: string[];
  dependsOn?: string[];
  mission: string;
  allowedPaths: string[];
  protectedPaths: string[];
  nonGoals: string[];
  existingDependencies: string[];
  dataContracts?: string;
  acceptanceCriteria: Array<{
    scenario: string;
    given: string;
    when: string;
    then: string;
  }>;
  verificationCommands: {
    lint: string;
    test: string;
    coverageThreshold: number;
  };
}): string {
  const listBlock = (key: string, items: string[] | undefined) => {
    if (!items || items.length === 0) return `${key}: []`;
    return `${key}:\n${items.map((i) => `  - "${i}"`).join("\n")}`;
  };

  const status = data.status ?? "Ready-For-Agent";

  const frontmatter = [
    "---",
    `task_id: "${data.taskId}"`,
    `title: "${data.title}"`,
    data.repo ? `repo: "${data.repo}"` : null,
    `shelf: "${data.shelf}"`,
    `book: "${data.book}"`,
    data.chapter ? `chapter: "${data.chapter}"` : null,
    `tags: [${data.tags.map((t) => `"${t}"`).join(", ")}]`,
    `status: "${status}"`,
    `complexity: "${data.complexity}"`,
    `owner: "${data.owner}"`,
    listBlock("publishes", data.publishes),
    listBlock("consumes", data.consumes),
    listBlock("impacts", data.impacts),
    listBlock("depends_on", data.dependsOn),
    "---",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const scenarios = data.acceptanceCriteria
    .map(
      (c, i) =>
        `* **Scenario ${i + 1}: ${c.scenario}**\n* **Given** ${c.given}\n* **When** ${c.when}\n* **Then** ${c.then}`,
    )
    .join("\n\n");

  return `${frontmatter}

# Specification: ${data.title}

## 1. Mission & Guardrails
* **Goal:** ${data.mission}
* **Allowed Scope:**
${data.allowedPaths.map((p) => `  * \`${p}\``).join("\n")}
* **Protected Scope (DO NOT TOUCH):**
${data.protectedPaths.length ? data.protectedPaths.map((p) => `  * \`${p}\``).join("\n") : "  * _(none)_"}
* **Non-Goals:**
${data.nonGoals.map((g) => `  * ${g}`).join("\n")}

## 2. Existing Utilities & Context
${data.existingDependencies.length ? data.existingDependencies.map((d) => `* ${d}`).join("\n") : "* _(none specified)_"}

## 3. Data Contracts
${data.dataContracts?.trim() ? `\`\`\`typescript\n${data.dataContracts.trim()}\n\`\`\`` : "_No contracts provided._"}

## 4. Acceptance Criteria (Gherkin)

${scenarios}

## 5. Verification & Test Guardrails

* \`${data.verificationCommands.lint}\`
* \`${data.verificationCommands.test}\`
* Minimum coverage requirement: ${data.verificationCommands.coverageThreshold}%
`;
}
