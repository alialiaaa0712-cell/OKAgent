import fs from "fs";
import path from "path";
import os from "os";

const CONFIG_DIR = path.join(os.homedir(), ".okcli");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

interface Config {
  api_key?: string;
  base_url?: string;
  model?: string;
}

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): Config {
  ensureConfigDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8")) as Config;
  } catch {
    return {};
  }
}

export function saveConfig(config: Config): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

export function getApiKey(): string {
  if (process.env.API_KEY) return process.env.API_KEY;
  const config = loadConfig();
  if (config.api_key) return config.api_key;
  throw new Error(
    "No API key found. Set API_KEY env var or run: okcli config set api_key <your-key>"
  );
}

export function getBaseUrl(): string | undefined {
  if (process.env.BASE_URL) return process.env.BASE_URL;
  const config = loadConfig();
  return config.base_url;
}

export function getModel(): string {
  const config = loadConfig();
  return config.model ?? "deepseek-chat";
}
