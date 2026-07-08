import { execSync } from "child_process";
import type { ToolDefinition } from "./types";

export const runShellTool: ToolDefinition = {
  spec: {
    name: "run_shell",
    description: "Execute a shell command and return stdout and stderr.",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command to execute" },
        cwd: { type: "string", description: "Working directory (optional)" },
      },
      required: ["command"],
    },
  },
  async execute(input) {
    const command = input.command as string;
    const cwd = (input.cwd as string | undefined) ?? process.cwd();
    try {
      const output = execSync(command, {
        cwd,
        timeout: 30000,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      return output || "(no output)";
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      const stdout = e.stdout ?? "";
      const stderr = e.stderr ?? "";
      const msg = e.message ?? "Unknown error";
      return [stdout, stderr, `Exit error: ${msg}`].filter(Boolean).join("\n");
    }
  },
};
