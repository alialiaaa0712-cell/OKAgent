import type Anthropic from "@anthropic-ai/sdk";

export interface ToolDefinition {
  spec: Anthropic.Tool;
  execute: (input: Record<string, unknown>) => Promise<string>;
}
