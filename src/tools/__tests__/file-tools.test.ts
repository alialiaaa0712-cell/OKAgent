import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { readFileTool } from "../read-file";
import { writeFileTool } from "../write-file";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "okcli-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("read_file", () => {
  it("读取存在的文件", async () => {
    const file = path.join(tmpDir, "hello.txt");
    fs.writeFileSync(file, "hello world", "utf-8");
    expect(await readFileTool.execute({ path: file })).toBe("hello world");
  });

  it("读取不存在的文件返回错误信息", async () => {
    const result = await readFileTool.execute({ path: path.join(tmpDir, "nope.txt") });
    expect(result).toMatch(/Error reading file/);
  });

  it("读取多行文件内容完整", async () => {
    const file = path.join(tmpDir, "multi.txt");
    fs.writeFileSync(file, "line1\nline2\nline3", "utf-8");
    expect(await readFileTool.execute({ path: file })).toBe("line1\nline2\nline3");
  });
});

describe("write_file", () => {
  it("写入新文件", async () => {
    const file = path.join(tmpDir, "out.txt");
    const result = await writeFileTool.execute({ path: file, content: "abc" });
    expect(result).toMatch(/Successfully wrote/);
    expect(fs.readFileSync(file, "utf-8")).toBe("abc");
  });

  it("覆盖已有文件", async () => {
    const file = path.join(tmpDir, "out.txt");
    fs.writeFileSync(file, "old content", "utf-8");
    await writeFileTool.execute({ path: file, content: "new content" });
    expect(fs.readFileSync(file, "utf-8")).toBe("new content");
  });

  it("自动创建不存在的父目录", async () => {
    const file = path.join(tmpDir, "a", "b", "c.txt");
    const result = await writeFileTool.execute({ path: file, content: "nested" });
    expect(result).toMatch(/Successfully wrote/);
    expect(fs.readFileSync(file, "utf-8")).toBe("nested");
  });

  it("成功信息包含写入字符数", async () => {
    const content = "hello";
    const result = await writeFileTool.execute({ path: path.join(tmpDir, "count.txt"), content });
    expect(result).toContain(String(content.length));
  });
});
