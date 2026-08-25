# Graph Report - spec-hub (2026-08-25)

## Corpus Check

- Corpus is ~4,673 words - fits in a single context window. You may not need a graph.

## Summary

- 291 nodes · 309 edges · 27 communities (18 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)

- MCP Server Package Config
- Shared Schemas Package Config
- Specification Schema Definitions
- Root Monorepo Package Config
- Codex Gate Package Config
- Web Application Dependencies
- MCP Server Tools and Resources
- Web App Dev Dependencies
- Base TypeScript Compiler Options
- MCP Server TypeScript Config
- Web App TypeScript Config
- Codex Gate TypeScript Config
- Shared Schemas TypeScript Config
- VS Code Configuration
- System Architecture and Monorepo Documentation
- Codex Gate Specification Analyzer
- Next.js Root Layout Component
- Agent System Rules & Docs
- ESLint Configuration
- Next.js Build Configuration
- PostCSS Styling Configuration
- File Icon Visual Asset
- Globe Icon Visual Asset
- Next.js Logo Asset
- Vercel Logo Asset
- Window Icon Visual Asset

## God Nodes (most connected - your core abstractions)

1. `compilerOptions` - 15 edges
2. `scripts` - 12 edges
3. `compilerOptions` - 11 edges
4. `scripts` - 7 edges
5. `include` - 7 edges
6. `registerResources()` - 6 edges
7. `registerTools()` - 6 edges
8. `scripts` - 6 edges
9. `scripts` - 6 edges
10. `scripts` - 6 edges

## Surprising Connections (you probably didn't know these)

- `Agent Spec Template` --semantically_similar_to--> `Agent-Ready Document Format Standard` [INFERRED] [semantically similar]
  packages/shared-schemas/templates/AGENT_SPEC.md → SPEC.md
- `PNPM Monorepo Workspace Config` --shares_data_with--> `Monorepo Package Structure` [INFERRED]
  pnpm-workspace.yaml → README.md
- `Docker Compose Stack` --conceptually_related_to--> `MCP BookStack Server` [INFERRED]
  docker-compose.yml → SPEC.md
- `Claude AGENTS Reference` --references--> `Next.js Agent Rules` [EXTRACTED]
  CLAUDE.md → AGENTS.md
- `Spec Hub Overview` --references--> `Spec Hub Specification` [EXTRACTED]
  README.md → SPEC.md

## Import Cycles

- None detected.

## Hyperedges (group relationships)

- **Spec Hub Core Architecture** — spec_md_developer_portal, spec_md_refinement_engine, spec_md_mcp_bookstack_server [INFERRED]

## Communities (27 total, 9 thin omitted)

### Community 0 - "MCP Server Package Config"

Cohesion: 0.07
Nodes (29): bin, spec-hub-mcp, dependencies, @spec-hub/shared-schemas, @modelcontextprotocol/sdk, zod, devDependencies, tsx (+21 more)

### Community 1 - "Shared Schemas Package Config"

Cohesion: 0.08
Nodes (23): dependencies, zod, devDependencies, typescript, exports, ./templates/AGENT_SPEC.md, files, dist (+15 more)

### Community 2 - "Specification Schema Definitions"

Cohesion: 0.19
Nodes (18): AcceptanceCriterion, AcceptanceCriterionSchema, SpecFormData, SpecFormSchema, AgentSpecBodySchema, AgentSpecComplexitySchema, AgentSpecDocument, AgentSpecDocumentSchema (+10 more)

### Community 3 - "Root Monorepo Package Config"

Cohesion: 0.10
Nodes (19): description, engines, node, name, packageManager, private, scripts, bookstack:down (+11 more)

### Community 4 - "Codex Gate Package Config"

Cohesion: 0.10
Nodes (19): dependencies, @spec-hub/shared-schemas, devDependencies, typescript, exports, @spec-hub/shared-schemas, typescript, main (+11 more)

### Community 5 - "Web Application Dependencies"

Cohesion: 0.11
Nodes (18): dependencies, @spec-hub/shared-schemas, next, react, react-dom, @spec-hub/shared-schemas, name, private (+10 more)

### Community 6 - "MCP Server Tools and Resources"

Cohesion: 0.22
Nodes (9): main(), registerBookContractsResource(), registerResources(), registerShelfSummaryResource(), registerSpecResource(), registerCreatePageTool(), registerTools(), registerSearchContextTool() (+1 more)

### Community 7 - "Web App Dev Dependencies"

Cohesion: 0.12
Nodes (17): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node, @types/react, @types/react-dom (+9 more)

### Community 8 - "Base TypeScript Compiler Options"

Cohesion: 0.12
Nodes (16): compilerOptions, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module (+8 more)

### Community 9 - "MCP Server TypeScript Config"

Cohesion: 0.13
Nodes (14): compilerOptions, lib, outDir, rootDir, types, exclude, extends, include (+6 more)

### Community 10 - "Web App TypeScript Config"

Cohesion: 0.14
Nodes (14): compilerOptions, allowJs, incremental, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 11 - "Codex Gate TypeScript Config"

Cohesion: 0.15
Nodes (12): compilerOptions, lib, outDir, rootDir, exclude, extends, include, dist (+4 more)

### Community 12 - "Shared Schemas TypeScript Config"

Cohesion: 0.15
Nodes (12): compilerOptions, lib, outDir, rootDir, exclude, extends, include, dist (+4 more)

### Community 13 - "VS Code Configuration"

Cohesion: 0.17
Nodes (11): exclude, extends, include, node_modules, ../../tsconfig.base.json, **/\*.mts, .next/dev/types/**/\*.ts, next-env.d.ts (+3 more)

### Community 14 - "System Architecture and Monorepo Documentation"

Cohesion: 0.18
Nodes (11): Docker Compose Stack, Agent Spec Template, PNPM Monorepo Workspace Config, Spec Hub Overview, Monorepo Package Structure, Agent-Ready Document Format Standard, Spec Hub Specification, Developer Portal Web App (+3 more)

### Community 15 - "Codex Gate Specification Analyzer"

Cohesion: 0.67
Nodes (4): analyzeSpecification(), GateFinding, GateResult, runLocalQualityGate()

### Community 16 - "Next.js Root Layout Component"

Cohesion: 0.40
Nodes (3): geistMono, geistSans, metadata

## Knowledge Gaps

- **162 isolated node(s):** `name`, `version`, `private`, `type`, `spec-hub-mcp` (+157 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `Web App Dev Dependencies` to `Web Application Dependencies`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `compilerOptions` connect `Web App TypeScript Config` to `VS Code Configuration`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _162 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `MCP Server Package Config` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Should `Shared Schemas Package Config` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Should `Root Monorepo Package Config` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Codex Gate Package Config` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
