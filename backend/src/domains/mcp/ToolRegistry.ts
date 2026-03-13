import { Injectable, Inject } from '@nestjs/common';
import type { IMcpTool, McpScope } from './interfaces/IMcpTool';
import { MCP_TOOLS } from './mcp.tokens';

@Injectable()
export class ToolRegistry {
  private readonly toolMap: Map<string, IMcpTool>;

  constructor(@Inject(MCP_TOOLS) tools: IMcpTool[]) {
    this.toolMap = new Map(tools.map(t => [t.name, t]));
  }

  getToolsForScope(scope: McpScope): IMcpTool[] {
    return Array.from(this.toolMap.values()).filter(t => (t.scopes as McpScope[]).includes(scope));
  }

  getTool(name: string): IMcpTool | undefined {
    return this.toolMap.get(name);
  }

  getOpenAIToolDefinitions(scope: McpScope): object[] {
    return this.getToolsForScope(scope).map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));
  }
}
