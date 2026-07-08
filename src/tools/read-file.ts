import fs from "fs";
import type { ToolDefinition } from "./types";

export const readFileTool: ToolDefinition = {
  spec: {
    name: "read_file",
    description: "Read the contents of a file at the given path.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute or relative file path" },
      },
      required: ["path"],
    },
  },
  async execute(input) {
    const filePath = input.path as string;
    try {
      return fs.readFileSync(filePath, "utf-8");
    } catch (err) {
      return `Error reading file: ${(err as Error).message}`;
    }
  },
};
