import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerShelfSummaryResource } from "./shelfSummary.js";
import { registerBookContractsResource } from "./bookContracts.js";
import { registerSpecResource } from "./spec.js";
import { registerGraphSummaryResource } from "./graphSummary.js";

export function registerResources(server: McpServer): void {
  registerShelfSummaryResource(server);
  registerBookContractsResource(server);
  registerSpecResource(server);
  registerGraphSummaryResource(server);
}
