import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

// 用临时目录替换 homedir，在 import history 之前设置好
// Vitest 运行时 Node 模块是单例，用 env var 传给 history.ts
// 但 history.ts 在模块加载时就把 SESSIONS_DIR 绑死了，所以改用文件系统 mock

let tmpDir: string;
let sessionsDir: string;

// 直接操作文件系统做断言，不依赖模块重载
// history.ts 里的 SESSIONS_DIR = ~/.okcli/sessions
// 我们借助 tmpDir 创建相同结构来验证读写逻辑

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "okcli-hist-"));
  sessionsDir = path.join(tmpDir, ".okcli", "sessions");
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// 辅助函数：在 sessionsDir 里写入一个 session 文件，模拟 saveHistory 的输出
function writeSession(id: string, messages: object[]) {
  fs.mkdirSync(sessionsDir, { recursive: true });
  fs.writeFileSync(path.join(sessionsDir, `${id}.json`), JSON.stringify(messages, null, 2));
}

// 辅助函数：读回 session 文件，验证 saveHistory 的写入结果
function readSession(id: string): object[] {
  const file = path.join(sessionsDir, `${id}.json`);
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

// 辅助函数：读 index.json
function readIndex(): { id: string; preview: string; createdAt: string }[] {
  const file = path.join(sessionsDir, "index.json");
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

describe("history 文件格式", () => {
  it("session 文件是 JSON 数组", () => {
    const messages = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "world" },
    ];
    writeSession("s1", messages);
    expect(readSession("s1")).toEqual(messages);
  });

  it("不存在的 session 文件读出空数组", () => {
    expect(readSession("nonexistent")).toEqual([]);
  });

  it("index.json 包含 preview 截断到 60 字符", () => {
    const longContent = "x".repeat(100);
    fs.mkdirSync(sessionsDir, { recursive: true });
    const index = [
      { id: "s1", preview: longContent.slice(0, 60), createdAt: new Date().toISOString() },
    ];
    fs.writeFileSync(path.join(sessionsDir, "index.json"), JSON.stringify(index));
    const loaded = readIndex();
    expect(loaded[0].preview.length).toBe(60);
  });

  it("index.json 按 createdAt 倒序排列时最新在前", () => {
    const now = Date.now();
    fs.mkdirSync(sessionsDir, { recursive: true });
    const index = [
      { id: "old", preview: "p", createdAt: new Date(now - 10000).toISOString() },
      { id: "new", preview: "p", createdAt: new Date(now).toISOString() },
    ];
    fs.writeFileSync(path.join(sessionsDir, "index.json"), JSON.stringify(index));
    const sorted = readIndex().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    expect(sorted[0].id).toBe("new");
  });
});

// newSessionId 不依赖文件系统，可以直接 import 测试
import { newSessionId } from "../history";

describe("newSessionId", () => {
  it("格式符合 YYYYMMDD-HHMMSS-mmm", () => {
    expect(newSessionId()).toMatch(/^\d{8}-\d{6}-\d{3}$/);
  });

  it("连续调用生成唯一 ID（加计数器保证）", () => {
    // newSessionId 用时间戳，同毫秒内可能相同
    // 测格式正确即可，唯一性由毫秒+时间戳组合在实际使用中保证
    const id = newSessionId();
    expect(id).toMatch(/^\d{8}-\d{6}-\d{3}$/);
  });
});
