# okcli 项目完全指南（初学者友好版）

> 这是一个用 TypeScript 写的命令行 AI 助手。你可以在终端里跟它聊天，让它帮你读文件、写文件、运行命令、列目录、抓网页。

---

## 📂 项目结构一览

```
okcli/
├── src/                      ← 源代码都在这里
│   ├── index.ts              ← 入口文件，程序从这里开始运行
│   ├── agent.ts              ← AI 智能体核心，负责和 AI 模型对话
│   ├── config.ts             ← 配置管理（API key、模型名等）
│   ├── history.ts            ← 对话历史管理（保存/读取聊天记录）
│   ├── summarize.ts          ← 长文本总结功能
│   └── tools/                ← AI 使用的工具集合
│       ├── index.ts          ← 工具汇总，把所有工具集中到一起
│       ├── types.ts          ← 工具的类型定义（每个工具长什么样）
│       ├── read-file.ts      ← 工具1：读文件
│       ├── write-file.ts     ← 工具2：写文件
│       ├── run-shell.ts      ← 工具3：运行 Shell 命令
│       ├── list-dir.ts       ← 工具4：列出目录内容
│       └── fetch.ts          ← 工具5：抓取网页
├── dist/                     ← 编译后的 JS 文件（自动生成，不用管）
├── package.json              ← 项目配置（依赖、脚本等）
├── tsconfig.json             ← TypeScript 编译器配置
├── README.md                 ← 项目说明文档
├── .env                      ← 环境变量（放 API key 等秘密信息）
├── .env.example              ← 环境变量模板（告诉你要填什么）
└── PROJECT_GUIDE.md          ← 就是你现在看的这个文件 😄
```

---

## 🚀 程序从哪开始？—— `src/index.ts`

**它是程序的入口**，就像一栋楼的大门。

当你执行 `node dist/index.js` 或 `npm start` 时，Node.js 会先执行这个文件。

### 它做了 4 件事：

#### ① 显示欢迎信息 & 等待你输入
```
okcli — Claude-powered CLI agent
Type /help for commands, or just start chatting.
> _
```
它用 Node.js 内置的 `readline` 模块在终端里创建一个输入框，等你打字。

#### ② 识别你的命令
你说的话分为两类：

| 你说的话 | 例子 | 处理方式 |
|---|---|---|
| 以 `/` 开头 | `/help`, `/clear`, `/exit` | 调用 `handleCommand()` 函数，执行特殊操作 |
| 普通聊天 | "帮我读一下 package.json" | 交给 Agent 处理 |

特殊命令有这些：

| 命令 | 功能 |
|---|---|
| `/help` | 显示帮助信息 |
| `/clear` | 清空聊天记录 |
| `/history` | 显示当前有多少条消息 |
| `/config` | 查看或修改配置（如切换 AI 模型） |
| `/config set key value` | 设置配置项，比如 `/config set model deepseek-chat` |
| `/summarize <文件路径>` | 总结一个文本文件的内容 |
| `/exit` | 退出程序 |

#### ③ 把普通聊天交给 Agent
如果你输入的不是命令，程序会创建一个 `Agent` 对象，调用它的 `run()` 方法，把你说的话和对话历史传过去。

#### ④ 自动保存聊天记录
每次对话后，程序会自动把历史存到 `~/.okcli/history.json`，下次启动时自动恢复。

---

## 🤖 AI 智能体核心 —— `src/agent.ts`

**这是整个项目的大脑**。它负责和 AI 模型（比如 DeepSeek 或 OpenAI）对话，并且决定什么时候调用工具。

### 核心逻辑（按顺序理解）：

```
你输入文字
    ↓
Agent 把你的话加入对话历史
    ↓
Agent 把完整对话发给 AI 模型
    ↓
            ┌─ AI 说完了（finish_reason = "stop"）
            │   → 把 AI 的回答返回给你
            │
AI 回复了 ──┤
            │
            └─ AI 想要调用工具（finish_reason = "tool_calls"）
                → Agent 执行那个工具（读文件/写文件/运行命令等）
                → 把工具结果发给 AI
                → AI 根据结果继续回答
                → 回到上一步判断，直到 AI 说完了
```

### 简单理解就是：

> **Agent 是一个"中间人"**：你把话告诉它 → 它转发给 AI → AI 决定要不要用工具 → 如果需要，Agent 帮忙执行工具 → 把结果告诉 AI → AI 给出最终回答 → Agent 把回答转交给你。

### 关键函数：

| 函数 | 作用 |
|---|---|
| `constructor(extraTools)` | 初始化 Agent，连接 AI 模型 |
| `run(userText, messages)` | 主入口：处理你的输入，返回 AI 的回答 |
| `executeTools(toolCalls)` | 执行 AI 要求调用的工具（可能同时调用多个） |
| `allTools()` | 合并内置工具和外部扩展工具 |

---

## ⚙️ 配置管理 —— `src/config.ts`

**管理程序的设置**，比如 API key、要用的模型、接口地址。

### 配置从哪里来？

```
环境变量（.env 文件）
    ↓ 优先
~/.okcli/config.json（配置文件）
    ↓ 如果都没有，就报错
```

### 提供的函数：

| 函数 | 作用 |
|---|---|
| `loadConfig()` | 从 `~/.okcli/config.json` 读取配置 |
| `saveConfig(config)` | 把配置保存到 `~/.okcli/config.json` |
| `getApiKey()` | 获取 API key（先看环境变量，再看配置文件） |
| `getBaseUrl()` | 获取 API 地址（DeepSeek 或 OpenAI 的地址） |
| `getModel()` | 获取模型名，默认 `"deepseek-chat"` |

### 日常用法：
```bash
# 查看当前配置
/config

# 切换模型
/config set model claude-sonnet-4-20250514
```

---

## 💬 对话历史管理 —— `src/history.ts`

**让你每次启动程序时还能接着上次聊**。

### 做了什么？

| 函数 | 作用 |
|---|---|
| `loadHistory()` | 程序启动时，从 `~/.okcli/history.json` 读取历史 |
| `saveHistory(messages)` | 每次对话后，把最新历史写入文件 |
| `clearHistory()` | 删除历史文件（相当于重新开始） |

> 历史文件存在你的家目录下：`~/.okcli/history.json`

---

## 📝 长文本总结 —— `src/summarize.ts`

**用来总结超长的文本文件**（比如一本书、一份长报告）。

### 为什么需要它？

AI 模型一次能处理的内容是有限的（上下文窗口）。如果文件太长，模型会"记不住"开头的部分。

### 它是怎么解决的？

```
超长文件
    ↓
按段落分成若干块（每块约 6 万字）
    ↓ ──── 并行 ────→
  块1 → 单独总结     → 块1总结
  块2 → 单独总结     → 块2总结  → 合并所有总结 → 最终总结
  块3 → 单独总结     → 块3总结
    ↓
如果合并后的总结还是太长 → 递归（再来一次分块总结）
```

这个过程叫做 **Map-Reduce（映射-归约）**：
- **Map（映射）**：把大任务拆成小块，同时处理
- **Reduce（归约）**：把所有小块的结果合并成最终结果

### 用法：
```bash
/summarize 我的长篇小说.txt
/summarize 报告.txt 提取关键发现和建议
```

---

## 🛠️ 工具系统 —— `src/tools/`

### 什么是"工具"？

工具就是 AI 可以调用的一系列功能。当你让 AI "帮我看看文件内容"，AI 不会直接读文件——它会请求调用 `read_file` 工具，然后 Agent 执行这个工具，把结果返回给 AI。

### 工具的定义格式（`src/tools/types.ts`）：

每个工具都长这样：

```typescript
{
  spec: {
    name: "工具名",          // AI 通过这个名字调用它
    description: "描述",     // 告诉 AI 这个工具是做什么的
    input_schema: { ... }    // 工具需要什么参数（JSON Schema 格式）
  },
  execute(input) { ... }     // 工具的实际功能代码
}
```

### 5 个内置工具

#### ① `readFile` —— 读文件 (`read-file.ts`)

| 项目 | 说明 |
|---|---|
| 参数 | `path`：文件路径 |
| 功能 | 读取指定文件的内容 |
| 例子 | "帮我看看 package.json" → 读文件并返回内容 |
| 代码逻辑 | `fs.readFileSync(filePath, "utf-8")` |

#### ② `writeFile` —— 写文件 (`write-file.ts`)

| 项目 | 说明 |
|---|---|
| 参数 | `path`：文件路径，`content`：要写的内容 |
| 功能 | 创建或覆盖一个文件 |
| 例子 | "帮我写一个 hello.txt，内容写 Hello World" |
| 代码逻辑 | 先创建目录（如果需要），然后用 `fs.writeFileSync` 写入 |

#### ③ `runShell` —— 运行命令 (`run-shell.ts`)

| 项目 | 说明 |
|---|---|
| 参数 | `command`：命令，`cwd`：工作目录（可选） |
| 功能 | 执行 Shell 命令，返回输出 |
| 例子 | "运行 ls -la" 或 "安装 npm 依赖" |
| 代码逻辑 | 用 `execSync` 执行命令，最长等 30 秒 |

#### ④ `listDir` —— 列目录 (`list-dir.ts`)

| 项目 | 说明 |
|---|---|
| 参数 | `path`：目录路径 |
| 功能 | 列出目录内的文件和子目录 |
| 例子 | "src 目录下有什么？" |
| 代码逻辑 | `fs.readdirSync` 读取目录，标记 `[dir]` 或 `[file]` |

#### ⑤ `fetchUrl` —— 抓网页 (`fetch.ts`)

| 项目 | 说明 |
|---|---|
| 参数 | `url`：网址，`headers`：请求头（可选） |
| 功能 | 用 HTTP GET 获取一个网页的内容 |
| 例子 | "帮我看看今天的新闻" |
| 代码逻辑 | 使用 `fetch` API 发送 HTTP 请求，返回状态码和正文 |

### 工具汇总中心 —— `src/tools/index.ts`

这个文件把所有工具汇总成一个数组和一个 Map：

```typescript
// 工具数组 —— 发给 AI 时告诉它"你有这些工具可用"
tools = [readFileTool, writeFileTool, runShellTool, listDirTool, fetchTool]

// 工具 Map —— 快速按名字找到对应的工具
toolMap = { "read_file" → readFileTool, "write_file" → writeFileTool, ... }
```

---

## 📦 依赖说明（`package.json`）

| 包名 | 作用 |
|---|---|
| `openai` | 官方 OpenAI SDK，用来发请求给 AI 模型（也兼容 DeepSeek） |
| `dotenv` | 从 `.env` 文件读取环境变量 |
| `typescript` | TypeScript 编译器，把 `.ts` 编译成 `.js` |
| `ts-node` | 直接运行 `.ts` 文件（开发时用） |
| `@types/node` | Node.js 的类型定义（让 TypeScript 认识 Node 的 API） |

---

## 🔄 整体流程总结

```
你启动程序
    ↓
index.ts 加载历史对话
    ↓
显示 "> " 等你输入
    ↓
你输入："/summarize report.txt"
    ↓                 ↓
 以 / 开头？      不是命令？
    ↓                 ↓
 handleCommand()   Agent.run()
    ↓                 ↓
 执行特殊操作     Agent 和 AI 对话
                  ↓ 需要工具？
                  ↓ 是 → 执行工具 → 继续对话
                  ↓ 否 → 返回回答
    ↓                 ↓
 显示结果 ←──────────┘
    ↓
 保存历史到 ~/.okcli/history.json
    ↓
 继续等待你的下一条输入
```

---

## 🎯 一句话总结

> **okcli 就是一个能读文件、写文件、运行命令的 AI 聊天机器人，跑在你的终端里。**
> - `index.ts` = 大门口
> - `agent.ts` = 大脑
> - `config.ts` = 设置面板
> - `history.ts` = 记忆存储
> - `summarize.ts` = 长文处理专家
> - `tools/` = 5 个能干的"手"

希望这份指南对你有帮助！😊
