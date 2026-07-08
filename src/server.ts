import "dotenv/config";
import express from "express";
import cors from "cors";
import { Agent } from "./agent";
import { Tracer } from "./tracer";
import {
  newSessionId,
  loadHistory,
  saveHistory,
  clearHistory,
  listSessions,
} from "./history";

const app = express();
app.use(cors());
app.use(express.json());

// 每个 session 有自己独立的 Agent 实例和消息数组，保存在内存里。
// key = sessionId, value = { agent, messages }
const sessions = new Map<string, { agent: Agent; messages: ReturnType<typeof loadHistory> }>();

function getOrCreateSession(sessionId: string) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      agent: new Agent([], new Tracer(sessionId)),
      messages: loadHistory(sessionId),
    });
  }
  return sessions.get(sessionId)!;
}

// ── GET /api/sessions ── 列出所有保存的 session ─────────────────────────────
app.get("/api/sessions", (_req, res) => {
  res.json(listSessions());
});

// ── POST /api/sessions ── 创建新 session，返回 sessionId ───────────────────
app.post("/api/sessions", (_req, res) => {
  const sessionId = newSessionId();
  sessions.set(sessionId, { agent: new Agent([], new Tracer(sessionId)), messages: [] });
  res.json({ sessionId });
});

// ── DELETE /api/sessions/:id ── 清除某个 session ──────────────────────────
app.delete("/api/sessions/:id", (req, res) => {
  const { id } = req.params;
  clearHistory(id);
  sessions.delete(id);
  res.json({ ok: true });
});

// ── GET /api/sessions/:id/messages ── 获取某 session 的历史消息 ────────────
app.get("/api/sessions/:id/messages", (req, res) => {
  const { id } = req.params;
  const session = getOrCreateSession(id);
  res.json(session.messages);
});

// ── POST /api/sessions/:id/chat ── 发消息，SSE 流式返回回复 ─────────────────
app.post("/api/sessions/:id/chat", async (req, res) => {
  const { id } = req.params;
  const { message } = req.body as { message: string };

  if (!message) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const session = getOrCreateSession(id);

  // 设置 SSE 响应头
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // 辅助函数：发送一条 SSE 事件
  function send(data: object) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  try {
    await session.agent.runStream(
      message,
      session.messages,
      // 每个文字 token 推给前端
      (text) => send({ type: "token", content: text }),
      // 工具调用状态变化推给前端
      (name, status) => send({ type: "tool", name, status })
    );

    // 流结束，保存历史
    saveHistory(id, session.messages);
    send({ type: "done" });
  } catch (err) {
    send({ type: "error", message: (err as Error).message });
  } finally {
    res.end();
  }
});

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`okcli server running at http://localhost:${PORT}`);
});
