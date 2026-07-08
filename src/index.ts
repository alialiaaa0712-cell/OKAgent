#!/usr/bin/env node
import "dotenv/config";
import readline from "readline";
import { Agent } from "./agent";
import { Summarizer } from "./summarize";
import { loadHistory, saveHistory, clearHistory, listSessions, newSessionId } from "./history";
import { loadConfig, saveConfig } from "./config";
import { Tracer } from "./tracer";
import type OpenAI from "openai";

type Message = OpenAI.Chat.ChatCompletionMessageParam;

const COMMANDS: Record<string, string> = {
  "/help":          "Show this help message",
  "/clear":         "Clear current session history",
  "/history":       "Show number of messages in current session",
  "/sessions":      "List all sessions",
  "/session new":   "Start a new session",
  "/session load <id>": "Load a previous session",
  "/config":        "Show or set config: /config set <key> <value>",
  "/summarize <path> [instruction]": "Summarize a text file",
  "/exit":          "Save and exit",
};

function printHelp(): void {
  console.log("\nAvailable commands:");
  for (const [cmd, desc] of Object.entries(COMMANDS)) {
    console.log(`  ${cmd.padEnd(36)} ${desc}`);
  }
  console.log();
}

// State shared across command handlers — use a wrapper object so handlers can
// mutate sessionId and messages in place without re-wiring closures.
interface AppState {
  sessionId: string;
  messages: Message[];
}

async function handleCommand(input: string, state: AppState): Promise<boolean> {
  const parts = input.trim().split(/\s+/);
  const cmd = parts[0];

  switch (cmd) {
    case "/help":
      printHelp();
      return true;

    case "/clear":
      clearHistory(state.sessionId);
      state.messages.splice(0);
      console.log("Session cleared.");
      return true;

    case "/history":
      console.log(`Session ${state.sessionId}: ${state.messages.length} messages.`);
      return true;

    case "/sessions": {
      const sessions = listSessions();
      if (sessions.length === 0) {
        console.log("No saved sessions.");
      } else {
        console.log("\nSaved sessions (newest first):");
        for (const s of sessions) {
          const active = s.id === state.sessionId ? " ← current" : "";
          console.log(`  ${s.id}  ${s.preview}${active}`);
        }
        console.log();
      }
      return true;
    }

    case "/session": {
      const sub = parts[1];

      if (sub === "new") {
        // Save current session before switching
        saveHistory(state.sessionId, state.messages);
        state.sessionId = newSessionId();
        state.messages.splice(0);
        console.log(`New session: ${state.sessionId}`);
        return true;
      }

      if (sub === "load") {
        const targetId = parts[2];
        if (!targetId) {
          console.log("Usage: /session load <id>");
          return true;
        }
        const loaded = loadHistory(targetId);
        if (loaded.length === 0) {
          console.log(`Session not found: ${targetId}`);
          return true;
        }
        saveHistory(state.sessionId, state.messages);
        state.sessionId = targetId;
        state.messages.splice(0, state.messages.length, ...loaded);
        console.log(`Loaded session ${targetId} (${loaded.length} messages).`);
        return true;
      }

      console.log("Usage: /session new  |  /session load <id>");
      return true;
    }

    case "/exit":
    case "/quit":
      console.log("Goodbye.");
      saveHistory(state.sessionId, state.messages);
      process.exit(0);

    case "/config": {
      if (parts[1] === "set" && parts[2] && parts[3]) {
        const cfg = loadConfig();
        (cfg as Record<string, string>)[parts[2]] = parts[3];
        saveConfig(cfg);
        console.log(`Set ${parts[2]} = ${parts[3]}`);
      } else {
        console.log(JSON.stringify(loadConfig(), null, 2));
      }
      return true;
    }

    case "/summarize": {
      const filePath = parts[1];
      const instruction = parts.slice(2).join(" ") || undefined;
      if (!filePath) {
        console.log("Usage: /summarize <path> [instruction]");
        return true;
      }
      const fsModule = await import("fs");
      let text: string;
      try {
        text = fsModule.readFileSync(filePath, "utf-8");
      } catch (err) {
        console.error(`Cannot read file: ${(err as Error).message}`);
        return true;
      }
      console.log("Summarizing...");
      const summary = await new Summarizer().summarize(text, instruction);
      console.log("\n" + summary + "\n");
      return true;
    }

    default:
      return false;
  }
}

async function main(): Promise<void> {
  const state: AppState = {
    sessionId: newSessionId(),
    messages: [],
  };

  const agent = new Agent([], new Tracer(state.sessionId));

  console.log("okcli — CLI agent");
  console.log(`Session: ${state.sessionId}`);
  console.log('Type /help for commands, or just start chatting.\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  const prompt = (): void => rl.question("> ", async (line) => {
    const input = line.trim();
    if (!input) { prompt(); return; }

    if (input.startsWith("/")) {
      const handled = await handleCommand(input, state);
      if (!handled) console.log(`Unknown command: ${input}. Type /help for a list.`);
      prompt();
      return;
    }

    try {
      const reply = await agent.run(input, state.messages);
      console.log("\n" + reply + "\n");
      saveHistory(state.sessionId, state.messages);
    } catch (err) {
      console.error("Error:", (err as Error).message);
    }

    prompt();
  });

  rl.on("close", () => {
    saveHistory(state.sessionId, state.messages);
    console.log("\nGoodbye.");
    process.exit(0);
  });

  prompt();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
