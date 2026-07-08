import fs from "fs";
import path from "path";
import type { ToolDefinition } from "./types";

export const writeFileTool: ToolDefinition = {
  spec: {
    name: "write_file",
    description: "Write content to a file. Creates the file if it does not exist, overwrites if it does.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute or relative file path" },
        content: { type: "string", description: "Content to write" },
      },
      required: ["path", "content"],
    },
  },
  async execute(input) {
    const filePath = input.path as string;
    const content = input.content as string;
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, "utf-8");
      return `Successfully wrote ${content.length} characters to ${filePath}`;
    } catch (err) {
      return `Error writing file: ${(err as Error).message}`;
    }
  },
};
