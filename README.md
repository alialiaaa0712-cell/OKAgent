# okcli

A CLI agent powered by any OpenAI-compatible model (DeepSeek, OpenAI, etc.). Chat in your terminal with tools to read/write files, run shell commands, browse directories, fetch URLs, and summarize long documents.

## Requirements

- Node.js 18+
- An API key for your chosen provider

## Setup

```bash
npm install
npm run build
```

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

```
API_KEY=your-api-key
BASE_URL=https://api.deepseek.com
# MODEL=deepseek-chat
```

Alternatively, set values in `~/.okcli/config.json` — environment variables take priority over the config file.

## Usage

```bash
node dist/index.js
```

Type any message to start a conversation. The agent uses tools automatically — just ask it to read a file, run a command, fetch a URL, etc.

## Commands

| Command | Description |
|---|---|
| `/help` | Show available commands |
| `/clear` | Clear conversation history |
| `/history` | Show number of messages in current history |
| `/config` | Show current config |
| `/config set <key> <value>` | Update a config value |
| `/summarize <path> [instruction]` | Summarize a text file |
| `/exit` | Save history and exit |

## Tools

| Tool | Description |
|---|---|
| `read_file` | Read the contents of a file |
| `write_file` | Write content to a file (creates directories as needed) |
| `run_shell` | Execute a shell command and capture stdout/stderr |
| `list_dir` | List the contents of a directory |
| `fetch_url` | Fetch the content of a URL via HTTP GET |

## Long-text summarization

`/summarize <path>` handles texts of any length. For files that exceed the model's context window, the text is split into chunks, each chunk is summarized independently (map phase), and the results are merged into a final summary (reduce phase). An optional instruction can be appended:

```
/summarize ./report.txt Extract the key findings and recommendations.
```

## Conversation persistence

History is saved to `~/.okcli/history.json` after every turn and reloaded on startup. Use `/clear` to start fresh.

## Configuration

Priority order: environment variable > `.env` file > `~/.okcli/config.json`.

| Key | Description | Default |
|---|---|---|
| `API_KEY` | Provider API key | — |
| `BASE_URL` | API base URL | provider default |
| `model` | Model name | `deepseek-chat` |

Examples:

```bash
# DeepSeek
BASE_URL=https://api.deepseek.com
MODEL=deepseek-chat

# OpenAI
BASE_URL=https://api.openai.com/v1
MODEL=gpt-4o
```

Change model at runtime:

```
/config set model deepseek-reasoner
```
