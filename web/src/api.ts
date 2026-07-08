export interface SessionMeta {
  id: string;
  createdAt: string;
  preview: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const BASE = "/api";

export async function listSessions(): Promise<SessionMeta[]> {
  const res = await fetch(`${BASE}/sessions`);
  return res.json();
}

export async function createSession(): Promise<string> {
  const res = await fetch(`${BASE}/sessions`, { method: "POST" });
  const data = await res.json();
  return data.sessionId;
}

export async function deleteSession(id: string): Promise<void> {
  await fetch(`${BASE}/sessions/${id}`, { method: "DELETE" });
}

export async function getMessages(sessionId: string): Promise<ChatMessage[]> {
  const res = await fetch(`${BASE}/sessions/${sessionId}/messages`);
  const raw = await res.json();
  // Filter to only user/assistant messages for display
  return (raw as Array<{ role: string; content: unknown }>)
    .filter((m) => m.role === "user" || m.role === "assistant")
    .filter((m) => typeof m.content === "string" && m.content)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content as string }));
}
