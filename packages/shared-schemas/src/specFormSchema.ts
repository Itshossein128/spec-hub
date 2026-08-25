import { z } from "zod";

export const AcceptanceCriterionSchema = z.object({
  scenario: z.string(),
  given: z.string(),
  when: z.string(),
  then: z.string(),
});

export const SpecFormSchema = z.object({
  shelfId: z.number().int().positive(),
  bookId: z.number().int().positive(),
  chapterId: z.number().int().optional(),
  title: z.string().min(5).max(120),
  tags: z.array(z.string()).min(1),
  taskType: z.enum(["FEATURE", "BUGFIX", "REFACTOR", "MIGRATION"]),
  complexity: z.enum(["TRIVIAL", "STANDARD", "COMPLEX", "ARCHITECTURAL"]),
  owner: z.string().default("Lead Engineer"),

  mission: z.string().min(20, "Goal description must be clear and concise"),
  allowedPaths: z.array(z.string()).min(1, "At least one target path required"),
  protectedPaths: z.array(z.string()).default([]),
  nonGoals: z.array(z.string()).min(1, "Define explicit out-of-scope boundaries"),

  existingDependencies: z.array(z.string()).default([]),
  dataContracts: z.string().optional(),
  acceptanceCriteria: z
    .array(AcceptanceCriterionSchema)
    .min(1, "At least one Gherkin scenario is required"),

  verificationCommands: z.object({
    lint: z.string().default("pnpm lint"),
    test: z.string().default("pnpm test"),
    coverageThreshold: z.number().min(0).max(100).default(80),
  }),
});

export type SpecFormData = z.infer<typeof SpecFormSchema>;
export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterionSchema>;
