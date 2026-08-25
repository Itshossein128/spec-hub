# AgentDoc Bridge

Monorepo for the multi-agent documentation & context hub described in [`SPEC.md`](./SPEC.md).

## Structure

```text
apps/
  web/           Next.js developer portal
  mcp-server/    BookStack MCP server (stdio)
packages/
  shared-schemas/  Zod schemas + Markdown templates
  codex-gate/      Spec analysis & quality gate
```

## Commands

```bash
pnpm install
pnpm dev          # Next.js portal
pnpm dev:mcp      # MCP server (watch)
pnpm build        # packages + apps
pnpm typecheck
```

## Packages

| Package | Name | Role |
|---|---|---|
| `apps/web` | `@agentdoc/web` | Spec form portal |
| `apps/mcp-server` | `@agentdoc/mcp-server` | BookStack MCP tools/resources |
| `packages/shared-schemas` | `@agentdoc/shared-schemas` | `SpecFormSchema`, agent-ready Markdown |
| `packages/codex-gate` | `@agentdoc/codex-gate` | Local quality gate (+ Codex hook later) |
