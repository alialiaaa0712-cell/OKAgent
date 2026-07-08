import type { ToolDefinition } from "./types";

export const calculatorTool: ToolDefinition = {
  spec: {
    name: "calculator",
    description: "Evaluate a mathematical expression and return the result. Supports +, -, *, /, **, % and parentheses.",
    input_schema: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "Math expression to evaluate, e.g. \"(3 + 5) * 2\" or \"2 ** 10\"",
        },
      },
      required: ["expression"],
    },
  },
  async execute(input) {
    const expr = input.expression as string;

    // Only allow safe characters: digits, operators, spaces, dots, parentheses
    if (!/^[\d\s\+\-\*\/\%\(\)\.\*\*]+$/.test(expr)) {
      return `Error: expression contains invalid characters: ${expr}`;
    }

    try {
      // Use Function instead of eval to avoid access to outer scope
      const result = new Function(`"use strict"; return (${expr})`)();
      if (typeof result !== "number" || !isFinite(result)) {
        return `Error: result is ${result}`;
      }
      return String(result);
    } catch (err) {
      return `Error: ${(err as Error).message}`;
    }
  },
};
