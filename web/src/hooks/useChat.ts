import { useState, useCallback, useRef } from "react";
import type { ChatMessage } from "../api";

interface ToolEvent {
  name: string;
  status: "running" | "done";
}

export function useChat(sessionId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const loadMessages = useCallback(async (msgs: ChatMessage[]) => {
    setMessages(msgs);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!sessionId || streaming) return;

      // Optimistically add user message
      setMessages((prev) => [...prev, { role: "user", content: text }]);
      setStreaming(true);

      // Placeholder for the assistant reply that we'll stream into
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      let closed = false;
      abortRef.current = () => { closed = true; };

      try {
        const res = await fetch(`/api/sessions/${sessionId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });

        if (!res.body) throw new Error("No response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          if (closed) break;
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            let event: { type: string; content?: string; name?: string; status?: string; message?: string };
            try {
              event = JSON.parse(line.slice(6));
            } catch {
              continue;
            }

            if (event.type === "token" && event.content) {
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last.role === "assistant") {
                  next[next.length - 1] = { ...last, content: last.content + event.content };
                }
                return next;
              });
            } else if (event.type === "tool") {
              const toolEvent = event as ToolEvent;
              setActiveTool(toolEvent.status === "running" ? toolEvent.name : null);
            } else if (event.type === "done" || event.type === "error") {
              if (event.type === "error") {
                setMessages((prev) => {
                  const next = [...prev];
                  next[next.length - 1] = { role: "assistant", content: `Error: ${event.message}` };
                  return next;
                });
              }
            }
          }
        }
      } catch (err) {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: `Error: ${(err as Error).message}` };
          return next;
        });
      } finally {
        setStreaming(false);
        setActiveTool(null);
        abortRef.current = null;
      }
    },
    [sessionId, streaming]
  );

  return { messages, streaming, activeTool, loadMessages, sendMessage };
}
