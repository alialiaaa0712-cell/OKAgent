import type { ToolDefinition } from "./types";

export const fetchTool: ToolDefinition = {
  spec: {
    name: "fetch_url",
    description: "Fetch the content of a URL via HTTP GET and return the response body as text.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to fetch" },
        headers: {
          type: "object",
          description: "Optional HTTP headers as key-value pairs",
          additionalProperties: { type: "string" },
        },
      },
      required: ["url"],
    },
  },
  async execute(input) {
    const url = input.url as string;
    const headers = (input.headers ?? {}) as Record<string, string>;
    try {
      const res = await fetch(url, { headers });
      const body = await res.text();
      return `HTTP ${res.status} ${res.statusText}\n\n${body}`;
    } catch (err) {
      return `Error fetching URL: ${(err as Error).message}`;
    }
  },
};
