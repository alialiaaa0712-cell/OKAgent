import { readFileTool } from "./read-file";
import { writeFileTool } from "./write-file";
import { runShellTool } from "./run-shell";
import { listDirTool } from "./list-dir";
import { fetchTool } from "./fetch";
import { calculatorTool } from "./calculator";
import type { ToolDefinition } from "./types";

export const tools: ToolDefinition[] = [
  readFileTool,
  writeFileTool,
  runShellTool,
  listDirTool,
  fetchTool,
  calculatorTool,
];

export const toolMap: Map<string, ToolDefinition> = new Map(
  tools.map((t) => [t.spec.name, t])
);
