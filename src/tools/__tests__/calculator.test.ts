import { describe, it, expect } from "vitest";
import { calculatorTool } from "../calculator";

const calc = (expr: string) => calculatorTool.execute({ expression: expr });

describe("calculator", () => {
  // 基本四则运算
  it("加法", async () => expect(await calc("1 + 2")).toBe("3"));
  it("减法", async () => expect(await calc("10 - 4")).toBe("6"));
  it("乘法", async () => expect(await calc("3 * 4")).toBe("12"));
  it("除法", async () => expect(await calc("10 / 4")).toBe("2.5"));
  it("取余", async () => expect(await calc("10 % 3")).toBe("1"));
  it("幂运算", async () => expect(await calc("2 ** 10")).toBe("1024"));

  // 括号与优先级
  it("括号改变优先级", async () => expect(await calc("(1 + 2) * 3")).toBe("9"));
  it("嵌套括号", async () => expect(await calc("((2 + 3) * (4 - 1))")).toBe("15"));

  // 浮点数
  it("浮点加法", async () => expect(await calc("0.1 + 0.2")).toMatch(/^0\.3/));

  // 非法字符 — 应返回错误信息而不是抛出
  it("拒绝字母", async () => {
    const result = await calc("Math.random()");
    expect(result).toMatch(/Error/);
  });
  it("拒绝分号", async () => {
    const result = await calc("1; process.exit(1)");
    expect(result).toMatch(/Error/);
  });
  it("拒绝单引号", async () => {
    const result = await calc("'a'");
    expect(result).toMatch(/Error/);
  });

  // 边界值
  it("除以零返回 Infinity 错误", async () => {
    const result = await calc("1 / 0");
    expect(result).toMatch(/Error/);
  });
  it("NaN 表达式返回错误", async () => {
    const result = await calc("0 / 0");
    expect(result).toMatch(/Error/);
  });
  it("空表达式返回错误", async () => {
    const result = await calc("");
    expect(result).toMatch(/Error/);
  });
});
