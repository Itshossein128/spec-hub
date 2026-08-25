import type { SpecFormData } from "@spec-hub/shared-schemas";
import { renderAgentReadyMarkdown } from "@spec-hub/shared-schemas";

const COMPLEXITY_MAP: Record<SpecFormData["complexity"], string> = {
  TRIVIAL: "Trivial",
  STANDARD: "Standard",
  COMPLEX: "Complex",
  ARCHITECTURAL: "Architectural",
};

export type SpecStatus = "Draft" | "In-Review" | "Ready-For-Agent";

export function ensureTaskId(data: SpecFormData): string {
  if (data.taskId?.trim()) return data.taskId.trim();
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const slug = data.title
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return `TSK-${stamp}-${slug || "SPEC"}`;
}

export function mapFormToMarkdown(
  data: SpecFormData,
  status: SpecStatus,
): string {
  return renderAgentReadyMarkdown({
    taskId: ensureTaskId(data),
    title: data.title,
    repo: data.repo,
    shelf: data.shelf,
    book: data.book,
    chapter: data.chapter,
    tags: data.tags,
    status,
    complexity: COMPLEXITY_MAP[data.complexity],
    owner: data.owner,
    publishes: data.publishes,
    consumes: data.consumes,
    impacts: data.impacts,
    dependsOn: data.dependsOn,
    mission: data.mission,
    allowedPaths: data.allowedPaths,
    protectedPaths: data.protectedPaths,
    nonGoals: data.nonGoals,
    existingDependencies: data.existingDependencies,
    dataContracts: data.dataContracts,
    acceptanceCriteria: data.acceptanceCriteria,
    verificationCommands: data.verificationCommands,
  });
}

export function tagsFromBookStack(tags: string[]): Array<{ name: string; value?: string }> {
  return tags.map((tag) => {
    const idx = tag.indexOf(":");
    if (idx > 0) {
      return { name: tag.slice(0, idx), value: tag.slice(idx + 1) };
    }
    return { name: tag };
  });
}
