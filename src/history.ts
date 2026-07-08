import fs from "fs";
import path from "path";
import os from "os";
import type OpenAI from "openai";

// session 文件存放目录：~/.okcli/sessions/
const SESSIONS_DIR = path.join(os.homedir(), ".okcli", "sessions");

type Message = OpenAI.Chat.ChatCompletionMessageParam;

// 每个 session 的元数据（存在 sessions 目录下的 index.json 里）
interface SessionMeta {
  id: string;
  createdAt: string; // ISO 时间字符串
  preview: string;   // 第一条用户消息的前 60 个字符，方便识别内容
}

function ensureSessionsDir(): void {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

function sessionFilePath(id: string): string {
  return path.join(SESSIONS_DIR, `${id}.json`);
}

function metaFilePath(): string {
  return path.join(SESSIONS_DIR, "index.json");
}

// ── 生成新 session ID ──────────────────────────────────────────────────────────
// 用时间戳做 ID，格式：20260101-153045-123，足够唯一也方便按时间排序
export function newSessionId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  return `${date}-${time}-${ms}`;
}

// ── 加载指定 session 的对话历史 ────────────────────────────────────────────────
export function loadHistory(sessionId: string): Message[] {
  const file = sessionFilePath(sessionId);
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as Message[];
  } catch {
    return [];
  }
}

// ── 保存对话历史，同时更新 index.json 里的元数据 ──────────────────────────────
export function saveHistory(sessionId: string, messages: Message[]): void {
  ensureSessionsDir();
  fs.writeFileSync(sessionFilePath(sessionId), JSON.stringify(messages, null, 2), "utf-8");

  // 更新 index.json：找到第一条用户消息作为预览
  const firstUser = messages.find((m) => m.role === "user");
  const preview = firstUser
    ? (typeof firstUser.content === "string" ? firstUser.content : JSON.stringify(firstUser.content)).slice(0, 60)
    : "(empty)";

  const index = loadIndex();
  const existing = index.findIndex((s) => s.id === sessionId);
  const meta: SessionMeta = { id: sessionId, createdAt: new Date().toISOString(), preview };
  if (existing >= 0) {
    index[existing] = meta;
  } else {
    index.push(meta);
  }
  fs.writeFileSync(metaFilePath(), JSON.stringify(index, null, 2), "utf-8");
}

// ── 清空当前 session 的历史（保留 session 记录，只清空消息）─────────────────────
export function clearHistory(sessionId: string): void {
  const file = sessionFilePath(sessionId);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  // 从 index 里也移除
  const index = loadIndex().filter((s) => s.id !== sessionId);
  ensureSessionsDir();
  fs.writeFileSync(metaFilePath(), JSON.stringify(index, null, 2), "utf-8");
}

// ── 读取所有 session 的元数据列表 ─────────────────────────────────────────────
export function loadIndex(): SessionMeta[] {
  const file = metaFilePath();
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as SessionMeta[];
  } catch {
    return [];
  }
}

// ── 列出所有 session（最新在前）──────────────────────────────────────────────
export function listSessions(): SessionMeta[] {
  return loadIndex().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
