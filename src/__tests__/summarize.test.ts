import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn().mockImplementation(async ({ messages }: { messages: { content: string }[] }) => {
  const userContent = messages[messages.length - 1].content as string;
  const match = userContent.match(/<text>([\s\S]*?)<\/text>/);
  const text = match ? match[1].trim() : userContent;
  return { choices: [{ message: { content: `[summary: ${text.slice(0, 20)}]` } }] };
});

vi.mock("openai", () => {
  class OpenAIMock {
    chat = { completions: { create: mockCreate } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(_opts: any) {}
  }
  return { default: OpenAIMock };
});

vi.mock("../config", () => ({
  getApiKey: () => "test-key",
  getBaseUrl: () => "https://api.test.com",
  getModel: () => "test-model",
}));

import { Summarizer } from "../summarize";

describe("Summarizer", () => {
  let summarizer: Summarizer;

  beforeEach(() => {
    summarizer = new Summarizer();
  });

  it("短文本直接返回摘要", async () => {
    const result = await summarizer.summarize("短文本");
    expect(result).toContain("[summary:");
  });

  it("自定义 instruction 会被传入", async () => {
    const result = await summarizer.summarize("内容", "提取关键词");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("空字符串不抛出", async () => {
    await expect(summarizer.summarize("")).resolves.toBeDefined();
  });

  it("长文本触发多次 API 调用", async () => {
    mockCreate.mockClear();

    // 超过 60K 字符的文本（多个段落）
    const bigText = Array.from({ length: 80 }, (_, i) =>
      `段落${i}: ${"文字".repeat(400)}`
    ).join("\n\n");

    await summarizer.summarize(bigText);
    expect(mockCreate.mock.calls.length).toBeGreaterThan(1);
  });
});
