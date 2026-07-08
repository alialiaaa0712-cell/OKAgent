import fs from "fs";
import type { ToolDefinition } from "./types";

export const listDirTool: ToolDefinition = {
  spec: {
    name: "list_dir",
    description: "List the contents of a directory.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path to list" },
      },
      required: ["path"],
    },
  },
  async execute(input) {
    const dirPath = input.path as string;
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      if (entries.length === 0) return "(empty directory)";
      return entries
        .map((e) => `${e.isDirectory() ? "[dir]  " : "[file] "}${e.name}`)
        .join("\n");
    } catch (err) {
      return `Error listing directory: ${(err as Error).message}`;
    }
  },
};
