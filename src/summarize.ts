import OpenAI from "openai";
import { getApiKey, getBaseUrl, getModel } from "./config";

// 每块文本的最大字符数。超过这个长度就需要切块。
// 60000 字符大约是 15000 个 token，给模型留出足够的输出空间。
const CHARS_PER_CHUNK = 60_000;

// 每次摘要请求最多让模型输出多少 token。
// 摘要不需要太长，1024 够用了。
const MAX_SUMMARY_TOKENS = 1024;

export class Summarizer {
  private client: OpenAI;
  private model: string;

  constructor() {
    this.client = new OpenAI({
      apiKey: getApiKey(),
      baseURL: getBaseUrl(),
    });
    this.model = getModel();
  }

  // ─── 入口方法 ────────────────────────────────────────────────────────────────
  // 对外暴露的唯一接口。调用方不需要关心文本有多长，这里会自动决定怎么处理。
  // instruction 是可选的自定义指令，不传则用默认的"做一个简洁摘要"。
  async summarize(text: string, instruction?: string): Promise<string> {
    // 如果没传自定义指令，用默认指令
    const task = instruction ?? "Provide a concise summary of the following text.";

    // ── 短文本：直接一次搞定 ──
    // 文本够短，不需要分块，直接发给模型
    if (text.length <= CHARS_PER_CHUNK) {
      return this.summarizeChunk(text, task);
    }

    // ── 长文本 map 阶段：把文章切成若干块，并行总结每一块 ──
    const chunks = this.splitIntoChunks(text, CHARS_PER_CHUNK);
    console.error(`[summarize] splitting into ${chunks.length} chunks...`);

    // Promise.all 让所有块同时并行发给模型，不用一块等一块，总耗时 = 最慢那块
    const chunkSummaries = await Promise.all(
      chunks.map((chunk, i) => {
        console.error(`[summarize] processing chunk ${i + 1}/${chunks.length}`);
        return this.summarizeChunk(chunk, task);
      })
    );

    // ── 长文本 reduce 阶段：把所有块的摘要拼在一起，再做一次最终汇总 ──
    // 用分隔线把各块摘要拼接起来
    const combined = chunkSummaries.join("\n\n---\n\n");

    // 极端情况：拼接后的摘要本身还是太长（比如原文几百万字）
    // 递归调用自己，对摘要再做一轮压缩，直到够短为止
    if (combined.length > CHARS_PER_CHUNK) {
      console.error("[summarize] reducing summaries recursively...");
      return this.summarize(combined, task);
    }

    // 正常情况：摘要够短了，做最终汇总，告诉模型"这些是分段摘要，请整合成一篇"
    console.error("[summarize] final reduction pass...");
    return this.summarizeChunk(
      combined,
      `You have been given summaries of parts of a longer document. ${task} Write a unified final summary.`
    );
  }

  // ─── 切块 ────────────────────────────────────────────────────────────────────
  // 按段落边界切块，而不是按固定字数硬切。
  // 这样每块内容相对完整，不会在句子中间断开，摘要质量更好。
  private splitIntoChunks(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    // 按连续空行（段落分隔符）把文本拆成段落数组
    const paragraphs = text.split(/\n\n+/);
    let current = ""; // 当前正在积累的块

    for (const para of paragraphs) {
      // 如果加上这段之后会超出块大小限制，就把当前积累的内容存起来，开新块
      if ((current + para).length > chunkSize && current.length > 0) {
        chunks.push(current.trimEnd());
        current = para + "\n\n"; // 新块从这段开始
      } else {
        // 还没超限，继续往当前块追加
        current += para + "\n\n";
      }
    }
    // 别忘了最后一块（循环结束时 current 可能还有内容）
    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }

  // ─── 调模型 ──────────────────────────────────────────────────────────────────
  // 最底层的操作：发一次请求给模型，返回模型的文字回复。
  // 其他方法都是在编排"什么时候调用它、用什么文本调用它"。
  private async summarizeChunk(text: string, instruction: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: MAX_SUMMARY_TOKENS,
      messages: [
        // 把指令和文本拼在一起作为 user 消息发给模型
        // <text> 标签是给模型看的提示，告诉它这部分是要处理的文本内容
        { role: "user", content: `${instruction}\n\n<text>\n${text}\n</text>` },
      ],
    });

    // 取模型回复的文字内容，如果是 null 就返回空字符串
    return response.choices[0].message.content ?? "";
  }
}
