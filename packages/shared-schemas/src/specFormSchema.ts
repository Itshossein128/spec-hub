import { z } from "zod";

export const AcceptanceCriterionSchema = z.object({
  scenario: z.string().min(1),
  given: z.string().min(1),
  when: z.string().min(1),
  then: z.string().min(1),
});

export const SpecFormSchema = z.object({
  taskId: z
    .string()
    .regex(/^TSK-[\w-]+$/i, 'task_id must look like "TSK-2026-08"')
    .optional(),
  shelfId: z.number().int().positive().optional(),
  bookId: z.number().int().positive().optional(),
  chapterId: z.number().int().optional(),
  shelf: z.string().min(1, "نام قفسه الزامی است"),
  book: z.string().min(1, "نام کتاب الزامی است"),
  chapter: z.string().optional(),
  title: z.string().min(5, "عنوان حداقل ۵ نویسه").max(120),
  tags: z.array(z.string()).min(1, "حداقل یک برچسب لازم است"),
  taskType: z.enum(["FEATURE", "BUGFIX", "REFACTOR", "MIGRATION"]),
  complexity: z.enum(["TRIVIAL", "STANDARD", "COMPLEX", "ARCHITECTURAL"]),
  owner: z.string().min(1, "مالک الزامی است"),

  mission: z.string().min(20, "توضیح مأموریت باید واضح و حداقل ۲۰ نویسه باشد"),
  allowedPaths: z.array(z.string()).min(1, "حداقل یک مسیر مجاز لازم است"),
  protectedPaths: z.array(z.string()),
  nonGoals: z.array(z.string()).min(1, "حداقل یک نباید (Non-Goal) تعریف کنید"),

  existingDependencies: z.array(z.string()),
  dataContracts: z.string().optional(),
  acceptanceCriteria: z
    .array(AcceptanceCriterionSchema)
    .min(1, "حداقل یک سناریوی Gherkin لازم است"),

  repo: z.string().min(1).optional(),
  publishes: z.array(z.string()),
  consumes: z.array(z.string()),
  impacts: z.array(z.string()),
  dependsOn: z.array(z.string()),

  verificationCommands: z.object({
    lint: z.string().min(1),
    test: z.string().min(1),
    coverageThreshold: z.number().min(0).max(100),
  }),
});

export type SpecFormData = z.infer<typeof SpecFormSchema>;
export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterionSchema>;
