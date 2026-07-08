// 引入 OpenAI 的 SDK。DeepSeek 兼容 OpenAI 接口格式，所以我们用这个库来发请求。
import OpenAI from "openai";

// 从 config.ts 里引入三个函数，分别用来读取 API key、接口地址、模型名。
import { getApiKey, getBaseUrl, getModel } from "./config";

// 引入工具列表和工具查找表。
import { tools, toolMap } from "./tools/index";

// 引入 ToolDefinition 类型。
import type { ToolDefinition } from "./tools/types";

// 引入 Tracer，用于记录调用轨迹。
import { Tracer } from "./tracer";

// 给 OpenAI 消息类型起一个短别名，方便在代码里使用。
type Message = OpenAI.Chat.ChatCompletionMessageParam;

// 粗略估算 messages 占用的字符总量。
// 真正的 token 数需要调 tokenizer，这里用字符数 / 4 做近似（英文约 1 token = 4 字符）。
function estimateChars(messages: Message[]): number {
  return messages.reduce((sum, m) => {
    const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
    return sum + content.length;
  }, 0);
}

// 用 class 把 Agent 的所有逻辑封装在一起。
// export 表示这个类可以被其他文件 import。
export class Agent {
  // private 表示这些属性只能在这个类内部访问，外部拿不到。
  private client: OpenAI;               // HTTP 客户端，负责发请求给 DeepSeek/OpenAI
  private model: string;                // 要使用的模型名，比如 "deepseek-chat"
  private extraTools: ToolDefinition[]; // 外部传入的额外工具（扩展用）
  private tracer?: Tracer;              // 可选的调用轨迹记录器，不传则不记录

  // 触发压缩的字符数阈值。约等于 40K token，给模型的输出留出足够空间。
  // deepseek-chat 上下文窗口是 64K token，这里保守取 160K 字符（~40K token）触发压缩。
  private readonly COMPRESS_THRESHOLD = 160_000;

  // 压缩时保留最近这么多条消息不动，只压缩更早的历史。
  // 保留最近 6 条是为了让模型还能看到当前对话的直接上下文。
  private readonly KEEP_RECENT = 6;

  // constructor 是类的初始化函数，new Agent() 时会自动执行。
  // extraTools 默认是空数组，tracer 可选，不传就不记录轨迹。
  constructor(extraTools: ToolDefinition[] = [], tracer?: Tracer) {
    // 创建 OpenAI 客户端实例，传入 API key 和接口地址。
    // baseURL 设置成 DeepSeek 的地址时，请求就会发给 DeepSeek 而不是 OpenAI。
    this.client = new OpenAI({
      apiKey: getApiKey(),
      baseURL: getBaseUrl(),
    });
    this.model = getModel();
    this.extraTools = extraTools;
    this.tracer = tracer;
  }

  // 把内置工具和外部传入的工具合并成一个数组。
  // ... 是展开运算符，相当于把数组里的元素逐个取出来放进新数组。
  private allTools(): ToolDefinition[] {
    return [...tools, ...this.extraTools];
  }

  // run 是主入口：接收用户输入的文字和当前的对话历史，返回模型最终的回复。
  // async 表示这是异步函数，内部可以用 await 等待网络请求完成。
  // Promise<string> 表示函数最终会返回一个字符串。
  async run(userText: string, messages: Message[]): Promise<string> {
    // 把用户这句话追加到对话历史里。
    messages.push({ role: "user", content: userText });
    this.tracer?.log({ type: "user", content: userText });

    // 循环：不断调用模型，直到模型不再要求调用工具为止。
    while (true) {
      // 每次发请求前先检查历史是否太长，太长就先压缩。
      await this.compressIfNeeded(messages);

      this.tracer?.log({ type: "llm_request", messageCount: messages.length });

      // 发请求给模型，遇到网络错误自动重试最多 3 次。
      const response = await this.callWithRetry(() =>
        this.client.chat.completions.create({
          model: this.model,
          messages,
          tools: this.allTools().map((t) => ({
            type: "function" as const,
            function: {
              name: t.spec.name,
              description: t.spec.description,
              parameters: t.spec.input_schema,
            },
          })),
          tool_choice: "auto",
        })
      );

      // 模型返回一个 choices 数组，通常只有一条，取第一条。
      const choice = response.choices[0];
      // choice.message 就是模型这轮的回复消息。
      const assistantMsg = choice.message;

      this.tracer?.log({
        type: "llm_response",
        finishReason: choice.finish_reason,
        contentPreview: (assistantMsg.content ?? "").slice(0, 200),
      });

      // 把模型的回复也记入对话历史，下一轮请求时会带上。
      messages.push(assistantMsg);

      // finish_reason === "stop" 表示模型认为对话结束，不需要调用工具。
      // assistantMsg.tool_calls?.length 用 ?. 安全访问（如果 tool_calls 是 undefined 不会报错）
      // 两个条件满足其一，就把模型的文字回复返回给用户，退出循环。
      if (choice.finish_reason === "stop" || !assistantMsg.tool_calls?.length) {
        const content = assistantMsg.content ?? "";
        this.tracer?.log({ type: "assistant", content });
        // ?? "" 是空值合并运算符：如果 content 是 null/undefined，就返回空字符串。
        return content;
      }

      // finish_reason === "tool_calls" 表示模型要调用工具。
      if (choice.finish_reason === "tool_calls") {
        // 执行所有工具，拿到结果列表。
        const toolResults = await this.executeTools(assistantMsg.tool_calls);
        // 把工具结果追加到对话历史，然后 continue 回到循环顶部再次调用模型。
        // ... 展开数组，把每条工具结果单独 push 进去（而不是把整个数组 push 成一个元素）。
        messages.push(...toolResults);
        continue;
      }

      // 其他意外的 finish_reason，直接返回现有内容。
      return assistantMsg.content ?? "";
    }
  }

  // ── 流式版本 ─────────────────────────────────────────────────────────────────
  // runStream 和 run 逻辑一样，区别是：每次模型产出一个文字 token，就立刻调用 onToken 回调。
  // 工具调用阶段仍然是非流式的（等工具执行完再继续），但文字输出部分是逐字推送的。
  //
  // 参数：
  //   onToken(text)   — 每收到一个文字片段就调用一次
  //   onTool(name, status) — 工具开始/结束时通知调用方（status: "running" | "done"）
  async runStream(
    userText: string,
    messages: Message[],
    onToken: (text: string) => void,
    onTool?: (name: string, status: "running" | "done") => void
  ): Promise<void> {
    messages.push({ role: "user", content: userText });
    this.tracer?.log({ type: "user", content: userText });

    while (true) {
      await this.compressIfNeeded(messages);
      this.tracer?.log({ type: "llm_request", messageCount: messages.length });

      // stream 模式不支持在流中途重试，所以只在建立连接时重试
      const stream = await this.callWithRetry(() =>
        this.client.chat.completions.create({
          model: this.model,
          messages,
          tools: this.allTools().map((t) => ({
            type: "function" as const,
            function: {
              name: t.spec.name,
              description: t.spec.description,
              parameters: t.spec.input_schema,
            },
          })),
          tool_choice: "auto",
          stream: true,
        })
      );

      // 逐 chunk 处理流，同时把完整消息拼起来留给后续工具调用或历史记录用
      let fullText = "";
      const toolCallAccumulator: Record<number, { id: string; name: string; arguments: string }> = {};
      let finishReason: string | null = null;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        finishReason = chunk.choices[0]?.finish_reason ?? finishReason;

        // 文字 token：推送给调用方
        if (delta.content) {
          fullText += delta.content;
          onToken(delta.content);
        }

        // 工具调用 delta：OpenAI 流式工具调用是分片推送的，需要在客户端拼装
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (!toolCallAccumulator[tc.index]) {
              toolCallAccumulator[tc.index] = { id: tc.id ?? "", name: "", arguments: "" };
            }
            const acc = toolCallAccumulator[tc.index];
            if (tc.id) acc.id = tc.id;
            if (tc.function?.name) acc.name += tc.function.name;
            if (tc.function?.arguments) acc.arguments += tc.function.arguments;
          }
        }
      }

      this.tracer?.log({
        type: "llm_response",
        finishReason,
        contentPreview: fullText.slice(0, 200),
      });

      const toolCalls = Object.values(toolCallAccumulator);

      if (finishReason === "stop" || toolCalls.length === 0) {
        // 模型说完了，把完整的 assistant 消息存入历史
        messages.push({ role: "assistant", content: fullText });
        this.tracer?.log({ type: "assistant", content: fullText });
        return;
      }

      // 模型要调用工具：把带有 tool_calls 的 assistant 消息存入历史
      messages.push({
        role: "assistant",
        content: fullText || null,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      });

      // 执行工具，通知调用方进度
      const openAiToolCalls = toolCalls.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: tc.arguments },
      }));

      const results = await Promise.all(
        openAiToolCalls.map(async (call) => {
          const tool =
            toolMap.get(call.function.name) ??
            this.extraTools.find((t) => t.spec.name === call.function.name);

          const input = call.function.arguments
            ? (JSON.parse(call.function.arguments) as Record<string, unknown>)
            : {};

          this.tracer?.log({ type: "tool_call", name: call.function.name, input });
          onTool?.(call.function.name, "running");

          let result: string;
          if (!tool) {
            result = `Unknown tool: ${call.function.name}`;
          } else {
            result = await tool.execute(input);
          }

          onTool?.(call.function.name, "done");
          this.tracer?.log({ type: "tool_result", name: call.function.name, result });

          return {
            role: "tool" as const,
            tool_call_id: call.id,
            content: result,
          };
        })
      );

      messages.push(...results);
      // continue 回到循环顶部，再次发流式请求让模型基于工具结果继续回复
    }
  }

  // 当历史消息超过阈值时，把早期消息压缩成一条摘要 system 消息。
  // 压缩失败时会把消息原样放回，不丢失历史。
  private async compressIfNeeded(messages: Message[]): Promise<void> {
    if (estimateChars(messages) <= this.COMPRESS_THRESHOLD) return;

    const before = messages.length;

    // 先把消息取出来，失败时放回，保证历史不丢失
    const recent = messages.splice(-this.KEEP_RECENT);
    const older = messages.splice(0);

    console.error(`[context] history too long, compressing ${older.length} messages...`);

    const historyText = older
      .map((m) => {
        const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
        return `[${m.role}]: ${content}`;
      })
      .join("\n\n");

    let summary: string;
    try {
      const response = await this.callWithRetry(() =>
        this.client.chat.completions.create({
          model: this.model,
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: `The following is a conversation history that needs to be condensed. Summarize it concisely, preserving key facts, decisions, and context that would be needed to continue the conversation:\n\n${historyText}`,
            },
          ],
        })
      );
      summary = response.choices[0].message.content ?? "(no summary)";
    } catch (err) {
      // 压缩失败：把消息原样放回，跳过压缩，继续正常对话
      console.error(`[context] compression failed, restoring history: ${(err as Error).message}`);
      messages.push(...older, ...recent);
      return;
    }

    messages.push({
      role: "system",
      content: `[Earlier conversation summary]: ${summary}`,
    });
    messages.push(...recent);

    const after = messages.length;
    this.tracer?.log({ type: "compress", before, after });
    console.error(`[context] compressed to ${after} messages`);
  }

  // 对任意异步操作做最多 3 次重试，使用指数退避。
  // 只重试网络类错误（超时、5xx），其他错误直接抛出。
  private async callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastErr: Error = new Error("unknown");
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err as Error;
        const msg = lastErr.message ?? "";
        // 只有网络/服务器错误才值得重试；认证失败、参数错误等直接抛出
        const isRetryable =
          msg.includes("timeout") ||
          msg.includes("ECONNRESET") ||
          msg.includes("ETIMEDOUT") ||
          msg.includes("socket hang up") ||
          /5\d\d/.test(msg); // 5xx 状态码
        if (!isRetryable) throw err;
        if (attempt < maxRetries - 1) {
          const delay = 1000 * 2 ** attempt; // 1s, 2s, 4s
          console.error(`[retry] attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    throw lastErr;
  }

  private async executeTools(
    toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[]
  ): Promise<OpenAI.Chat.ChatCompletionToolMessageParam[]> {

    // 在函数内部临时定义一个类型，描述"function 类型的工具调用"的结构。
    type FunctionCall = { type: "function"; id: string; function: { name: string; arguments: string } };

    // Promise.all 并行执行所有工具调用，等全部完成后一起返回结果数组。
    return Promise.all(
      toolCalls
        // filter 过滤掉非 function 类型的调用（目前只有 function 类型，这是防御性写法）。
        // (call): call is FunctionCall 是类型守卫，告诉 TypeScript 过滤后数组里的元素一定是 FunctionCall 类型。
        .filter((call): call is FunctionCall => call.type === "function")
        // map 把每个工具调用转换成一个异步操作。
        .map(async (call) => {
          // 先在内置工具表里找，找不到再去 extraTools 里找。
          // ?? 是空值合并运算符：左边是 null/undefined 就取右边的值。
          const tool =
            toolMap.get(call.function.name) ??
            this.extraTools.find((t) => t.spec.name === call.function.name);

          // 模型传来的参数是 JSON 字符串，需要先 parse 成对象。
          // as Record<string, unknown> 告诉 TypeScript 这是一个键为字符串、值类型未知的对象。
          const input = JSON.parse(call.function.arguments) as Record<string, unknown>;

          this.tracer?.log({ type: "tool_call", name: call.function.name, input });

          let result: string;
          if (!tool) {
            // 找不到这个工具，返回错误信息。
            result = `Unknown tool: ${call.function.name}`;
          } else {
            // 调用工具的 execute 函数，等待执行结果。
            result = await tool.execute(input);
          }

          this.tracer?.log({ type: "tool_result", name: call.function.name, result });

          // 返回一条工具结果消息，格式是 OpenAI 要求的。
          // role: "tool" 告诉模型这是工具执行的结果。
          // tool_call_id 必须和模型请求里的 id 对应，模型才知道这是哪个工具的结果。
          return {
            role: "tool" as const,
            tool_call_id: call.id,
            content: result,
          };
        })
    );
  }
}
