import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCreatePageTool } from "./createPage.js";
import { registerSearchContextTool } from "./searchContext.js";
import { registerValidateSpecTool } from "./validateSpec.js";
import { registerGraphTools } from "./graphTools.js";

export function registerTools(server: McpServer): void {
  registerCreatePageTool(server);
  registerSearchContextTool(server);
  registerValidateSpecTool(server);
  registerGraphTools(server);
}
