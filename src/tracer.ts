import fs from "fs";
import path from "path";
import os from "os";

const TRACES_DIR = path.join(os.homedir(), ".okcli", "traces");

export type TraceEvent =
  | { type: "user"; content: string }
  | { type: "llm_request"; messageCount: number }
  | { type: "llm_response"; finishReason: string | null; contentPreview: string }
  | { type: "tool_call"; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; name: string; result: string }
  | { type: "assistant"; content: string }
  | { type: "compress"; before: number; after: number }
  | { type: "error"; message: string };

export class Tracer {
  private file: string;

  constructor(sessionId: string) {
    if (!fs.existsSync(TRACES_DIR)) {
      fs.mkdirSync(TRACES_DIR, { recursive: true });
    }
    this.file = path.join(TRACES_DIR, `${sessionId}.jsonl`);
  }

  log(event: TraceEvent): void {
    const line = JSON.stringify({ ts: new Date().toISOString(), ...event });
    fs.appendFileSync(this.file, line + "\n", "utf-8");
  }
}
