# Spec Hub

Monorepo for the multi-agent documentation & context hub described in [`SPEC.md`](./SPEC.md).

## Structure

```text
apps/
  web/           Next.js developer portal
  mcp-server/    BookStack MCP server (stdio)
packages/
  shared-schemas/  Zod schemas + Markdown templates
  codex-gate/      Spec analysis & publish-before-consume gate
  bookstack-graph/ Corpus sync, structural enricher, graph query
data/
  bookstack-corpus/  Synced Agent-Ready markdown (generated)
graphify-out/
  bookstack/         Wiki knowledge graph (isolated from code graph)
```

## Commands

```bash
pnpm install
pnpm bookstack:up          # Docker BookStack
pnpm bookstack:sync        # Sync fixtures (or API if tokens set) → data/bookstack-corpus
pnpm bookstack:graph       # Typed edges + graphify HTML → graphify-out/bookstack/
pnpm bookstack:graph:update
# Open graphify-out/bookstack/graph.html in a browser for the interactive viz
pnpm dev                   # Portal at http://localhost:3000 (+ BookStack up)
# Author specs: http://localhost:3000/specs/new
pnpm dev:web               # Portal only (no docker)
pnpm dev:mcp               # MCP server (watch)
pnpm build
pnpm typecheck
pnpm --filter @spec-hub/bookstack-graph test
```

### Web portal

1. `pnpm dev` (or `pnpm dev:web`)
2. Open [http://localhost:3000/specs/new](http://localhost:3000/specs/new)
3. Fill the Agent-Ready form — live markdown + quality gate run in the side panel
4. **Validate as Draft** warns on orphan `consumes`; **Publish Ready-For-Agent** blocks until a publisher exists (or use `external:…`)
5. With BookStack API tokens set, select a book and **Save Draft** / **Publish Ready-For-Agent**
6. After publish: `pnpm bookstack:sync` (API) then `pnpm bookstack:graph` to refresh the wiki graph

### BookStack API tokens

1. Open `http://localhost:7875` and create an admin user.
2. Profile → API Tokens → Create Token.
3. Copy into `.env`:

```bash
BOOKSTACK_URL=http://localhost:7875
BOOKSTACK_TOKEN_ID=...
BOOKSTACK_TOKEN_SECRET=...
```

Without tokens, `pnpm bookstack:sync` uses offline fixtures under `packages/bookstack-graph/fixtures`.

## Packages

| Package                    | Name                        | Role                                          |
| -------------------------- | --------------------------- | --------------------------------------------- |
| `apps/web`                 | `@spec-hub/web`             | Spec form portal                              |
| `apps/mcp-server`          | `@spec-hub/mcp-server`      | BookStack + graph MCP tools/resources         |
| `packages/shared-schemas`  | `@spec-hub/shared-schemas`  | `SpecFormSchema`, Agent-Ready Markdown        |
| `packages/codex-gate`      | `@spec-hub/codex-gate`      | Local + Codex CLI quality gate (`assertConsumesResolved`, `analyzeSpecification`) |
| `packages/bookstack-graph` | `@spec-hub/bookstack-graph` | Sync / enrich / graph_query / graph_path      |
